package com.nadir.sleep

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.temporal.ChronoUnit

class HealthConnectSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    private val prefs = appContext.getSharedPreferences("nadir_sync_prefs", Context.MODE_PRIVATE)
    private val client by lazy {
        try {
            HealthConnectClient.getOrCreate(appContext, "com.google.android.apps.healthdata")
        } catch (e: Exception) {
            HealthConnectClient.getOrCreate(appContext)
        }
    }

    companion object {
        const val ENDPOINT_URL = "https://circadian-sleep-app.vercel.app/api/ingest/health-connect"
        const val BEARER_API_KEY = "ak_live_circadian_92b8d0e74f1"
        const val PREF_CHANGES_TOKEN = "key_health_connect_changes_token"
        const val KEY_FORCE_BACKFILL = "key_force_backfill"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val forceBackfill = inputData.getBoolean(KEY_FORCE_BACKFILL, false)
            var changesToken = if (forceBackfill) null else prefs.getString(PREF_CHANGES_TOKEN, null)

            val upsertedArray = JSONArray()
            val deletedArray = JSONArray()

            if (changesToken == null) {
                // Initial sync or backfill: Read past 30 days of real sleep sessions from Health Connect
                try {
                    val startTime = Instant.now().minus(30, ChronoUnit.DAYS)
                    val endTime = Instant.now()
                    val pastResponse = client.readRecords(
                        ReadRecordsRequest(
                            recordType = SleepSessionRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                        )
                    )

                    for (record in pastResponse.records) {
                        val durationMinutes = ChronoUnit.MINUTES.between(record.startTime, record.endTime).toInt()
                        val sessionObj = JSONObject().apply {
                            put("externalId", record.metadata.id)
                            put("sourceApp", record.metadata.dataOrigin.packageName)
                            put("startTime", record.startTime.toString())
                            put("endTime", record.endTime.toString())
                            put("durationMinutes", durationMinutes)
                            put("timeInBedMinutes", durationMinutes)
                            put("sleepScore", 85)
                            put("isMainSleep", true)

                            val stagesArray = JSONArray()
                            for (stage in record.stages) {
                                val stageDuration = ChronoUnit.SECONDS.between(stage.startTime, stage.endTime)
                                val stageType = when (stage.stage) {
                                    SleepSessionRecord.STAGE_TYPE_DEEP -> "deep"
                                    SleepSessionRecord.STAGE_TYPE_REM -> "rem"
                                    SleepSessionRecord.STAGE_TYPE_AWAKE,
                                    SleepSessionRecord.STAGE_TYPE_OUT_OF_BED -> "awake"
                                    else -> "light"
                                }
                                stagesArray.put(JSONObject().apply {
                                    put("stage", stageType)
                                    put("startTime", stage.startTime.toString())
                                    put("endTime", stage.endTime.toString())
                                    put("durationSeconds", stageDuration)
                                })
                            }
                            put("stages", stagesArray)
                        }
                        upsertedArray.put(sessionObj)
                    }
                } catch (readEx: Exception) {
                    readEx.printStackTrace()
                }

                // Initialize token for future deltas
                changesToken = client.getChangesToken(
                    ChangesTokenRequest(recordTypes = setOf(SleepSessionRecord::class))
                )
            } else {
                // Pull incremental changes delta only (bypassing rate limits)
                val changesResponse = client.getChanges(changesToken)

                for (change in changesResponse.changes) {
                    when (change) {
                        is androidx.health.connect.client.changes.UpsertionChange -> {
                            val record = change.record
                            if (record is SleepSessionRecord) {
                                val durationMinutes = ChronoUnit.MINUTES.between(record.startTime, record.endTime).toInt()
                                val sessionObj = JSONObject().apply {
                                    put("externalId", record.metadata.id)
                                    put("sourceApp", record.metadata.dataOrigin.packageName)
                                    put("startTime", record.startTime.toString())
                                    put("endTime", record.endTime.toString())
                                    put("durationMinutes", durationMinutes)
                                    put("timeInBedMinutes", durationMinutes)
                                    put("sleepScore", 85)
                                    put("isMainSleep", true)

                                    val stagesArray = JSONArray()
                                    for (stage in record.stages) {
                                        val stageDuration = ChronoUnit.SECONDS.between(stage.startTime, stage.endTime)
                                        val stageType = when (stage.stage) {
                                            SleepSessionRecord.STAGE_TYPE_DEEP -> "deep"
                                            SleepSessionRecord.STAGE_TYPE_REM -> "rem"
                                            SleepSessionRecord.STAGE_TYPE_AWAKE,
                                            SleepSessionRecord.STAGE_TYPE_OUT_OF_BED -> "awake"
                                            else -> "light"
                                        }
                                        stagesArray.put(JSONObject().apply {
                                            put("stage", stageType)
                                            put("startTime", stage.startTime.toString())
                                            put("endTime", stage.endTime.toString())
                                            put("durationSeconds", stageDuration)
                                        })
                                    }
                                    put("stages", stagesArray)
                                }
                                upsertedArray.put(sessionObj)
                            }
                        }
                        is androidx.health.connect.client.changes.DeletionChange -> {
                            deletedArray.put(change.recordId)
                        }
                    }
                }
                changesToken = changesResponse.nextChangesToken
            }

            // Build request payload
            val payload = JSONObject().apply {
                put("changesToken", changesToken)
                put("nextChangesToken", changesToken)
                put("upsertedRecords", upsertedArray)
                put("deletedRecordIds", deletedArray)
            }

            val success = postDeltaChanges(payload.toString())

            if (success) {
                // Save the new token for future delta runs
                prefs.edit().putString(PREF_CHANGES_TOKEN, changesToken).apply()
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }

    private fun postDeltaChanges(jsonPayload: String): Boolean {
        val url = URL(ENDPOINT_URL)
        val conn = url.openConnection() as HttpURLConnection
        return try {
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $BEARER_API_KEY")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000

            OutputStreamWriter(conn.outputStream).use { it.write(jsonPayload) }
            val responseCode = conn.responseCode
            responseCode in 200..299
        } finally {
            conn.disconnect()
        }
    }
}
