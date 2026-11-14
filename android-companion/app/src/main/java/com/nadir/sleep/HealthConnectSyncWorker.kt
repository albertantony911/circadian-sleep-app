package com.nadir.sleep

import android.content.Context
import android.util.Log
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
        const val TAG = "NadirSync"
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

                    Log.d(TAG, "Health Connect records read: ${pastResponse.records.size}")

                    for (record in pastResponse.records) {
                        val durationMinutes = ChronoUnit.MINUTES.between(record.startTime, record.endTime).toInt()
                        if (durationMinutes <= 0) continue

                        Log.d(TAG, "Read record ${record.metadata.id} from ${record.metadata.dataOrigin.packageName}: ${record.startTime} -> ${record.endTime} ($durationMinutes min)")

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
                                if (stageDuration <= 0) continue

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
                    Log.e(TAG, "Error reading Health Connect records", readEx)
                }

                // Initialize token for future deltas
                try {
                    changesToken = client.getChangesToken(
                        ChangesTokenRequest(recordTypes = setOf(SleepSessionRecord::class))
                    )
                } catch (tEx: Exception) {
                    Log.e(TAG, "Error getting changes token", tEx)
                }
            } else {
                // Pull incremental changes delta only (bypassing rate limits)
                try {
                    val changesResponse = client.getChanges(changesToken)

                    for (change in changesResponse.changes) {
                        when (change) {
                            is androidx.health.connect.client.changes.UpsertionChange -> {
                                val record = change.record
                                if (record is SleepSessionRecord) {
                                    val durationMinutes = ChronoUnit.MINUTES.between(record.startTime, record.endTime).toInt()
                                    if (durationMinutes > 0) {
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
                                                if (stageDuration <= 0) continue

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
                            }
                            is androidx.health.connect.client.changes.DeletionChange -> {
                                deletedArray.put(change.recordId)
                            }
                        }
                    }
                    changesToken = changesResponse.nextChangesToken
                } catch (cEx: Exception) {
                    Log.e(TAG, "Error reading changes delta", cEx)
                }
            }

            Log.d(TAG, "Posting to cloud: ${upsertedArray.length()} upserts, ${deletedArray.length()} deletes")

            // Build request payload
            val payload = JSONObject().apply {
                put("changesToken", changesToken ?: "")
                put("nextChangesToken", changesToken ?: "")
                put("upsertedRecords", upsertedArray)
                put("deletedRecordIds", deletedArray)
            }

            val statusCode = postDeltaChanges(payload.toString())
            Log.d(TAG, "Cloud sync HTTP status: $statusCode")

            if (statusCode in 200..299) {
                if (changesToken != null) {
                    prefs.edit().putString(PREF_CHANGES_TOKEN, changesToken).apply()
                }
                Result.success()
            } else if (statusCode in 400..499) {
                // Client error (e.g. 401/403/400) -> do not loop indefinitely
                Log.e(TAG, "Ingest client error $statusCode, aborting retry loop")
                Result.failure()
            } else {
                // Server error (500/504) -> allow single retry
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "HealthConnectSyncWorker exception", e)
            Result.failure()
        }
    }

    private fun postDeltaChanges(jsonPayload: String): Int {
        val url = URL(ENDPOINT_URL)
        val conn = url.openConnection() as HttpURLConnection
        return try {
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $BEARER_API_KEY")
            conn.doOutput = true
            conn.connectTimeout = 25000
            conn.readTimeout = 25000

            OutputStreamWriter(conn.outputStream).use { it.write(jsonPayload) }
            val responseCode = conn.responseCode
            if (responseCode !in 200..299) {
                val errorMsg = conn.errorStream?.bufferedReader()?.use { it.readText() }
                Log.e(TAG, "Ingest error response ($responseCode): $errorMsg")
            }
            responseCode
        } catch (ioEx: Exception) {
            Log.e(TAG, "Network connection error", ioEx)
            -1
        } finally {
            conn.disconnect()
        }
    }
}
