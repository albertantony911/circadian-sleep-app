package com.nadir.sleep

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.request.GetChangesRequest
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.temporal.ChronoUnit

class HealthConnectSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    private val prefs = appContext.getSharedPreferences("nadir_sync_prefs", Context.MODE_PRIVATE)
    private val client = HealthConnectClient.getOrCreate(appContext)

    companion object {
        const val ENDPOINT_URL = "https://circadian-sleep-app.vercel.app/api/ingest/health-connect"
        const val BEARER_API_KEY = "ak_live_circadian_92b8d0e74f1"
        const val PREF_CHANGES_TOKEN = "key_health_connect_changes_token"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            var changesToken = prefs.getString(PREF_CHANGES_TOKEN, null)
            if (changesToken == null) {
                // Initialize token for SleepSessionRecord
                changesToken = client.getChangesToken(
                    ChangesTokenRequest(recordTypes = setOf(SleepSessionRecord::class))
                )
            }

            // Pull incremental changes delta only (bypassing rate limits)
            val changesResponse = client.getChanges(GetChangesRequest(changesToken))

            val upsertedArray = JSONArray()
            val deletedArray = JSONArray()

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

            // Build request payload
            val payload = JSONObject().apply {
                put("changesToken", changesToken)
                put("nextChangesToken", changesResponse.nextChangesToken)
                put("upsertedRecords", upsertedArray)
                put("deletedRecordIds", deletedArray)
            }

            val success = postDeltaChanges(payload.toString())

            if (success) {
                // Save the new token for tomorrow's delta
                prefs.edit().putString(PREF_CHANGES_TOKEN, changesResponse.nextChangesToken).apply()
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
