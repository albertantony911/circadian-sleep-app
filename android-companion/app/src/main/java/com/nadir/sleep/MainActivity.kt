package com.nadir.sleep

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.lifecycle.lifecycleScope
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private lateinit var requestPermissionLauncher: ActivityResultLauncher<Set<String>>
    private val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(SleepSessionRecord::class)
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val txtStatus = findViewById<TextView>(R.id.txtStatus)
        val btnGrant = findViewById<Button>(R.id.btnGrant)
        val btnSync = findViewById<Button>(R.id.btnSync)

        val providerPackageName = "com.google.android.apps.healthdata"
        val availabilityStatus = HealthConnectClient.getSdkStatus(this, providerPackageName)

        if (availabilityStatus != HealthConnectClient.SDK_AVAILABLE) {
            txtStatus.text = "Health Connect requires setup:\nStatus code: $availabilityStatus\nPlease open Health Connect from Settings."
        }

        val healthConnectClient = try {
            HealthConnectClient.getOrCreate(this, providerPackageName)
        } catch (e: Exception) {
            try {
                HealthConnectClient.getOrCreate(this)
            } catch (ex: Exception) {
                txtStatus.text = "Error connecting to Health Connect:\n${ex.message}"
                null
            }
        }

        requestPermissionLauncher = registerForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { granted ->
            if (granted.containsAll(PERMISSIONS)) {
                txtStatus.text = "✓ Health Connect sleep permissions granted!\nAuto-sync is active."
                scheduleDailySync()
            } else {
                txtStatus.text = "⚠️ Sleep permissions required to sync records."
            }
        }

        btnGrant.setOnClickListener {
            if (healthConnectClient == null) {
                Toast.makeText(this, "Health Connect service not available", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            lifecycleScope.launch {
                try {
                    val granted = healthConnectClient.permissionController.getGrantedPermissions()
                    if (granted.containsAll(PERMISSIONS)) {
                        txtStatus.text = "✓ Already granted! Daily delta sync active."
                        scheduleDailySync()
                    } else {
                        requestPermissionLauncher.launch(PERMISSIONS)
                    }
                } catch (e: Exception) {
                    txtStatus.text = "Permission error: ${e.message}"
                }
            }
        }

        btnSync.setOnClickListener {
            txtStatus.text = "Syncing delta changes to Nadir Vercel..."
            val workRequest = OneTimeWorkRequestBuilder<HealthConnectSyncWorker>().build()
            WorkManager.getInstance(this).enqueue(workRequest)
            Toast.makeText(this, "Sync triggered in background", Toast.LENGTH_SHORT).show()
        }

        val btnBackfill = findViewById<Button>(R.id.btnBackfill)
        btnBackfill.setOnClickListener {
            txtStatus.text = "Backfilling past 30 days from Health Connect..."
            val workRequest = OneTimeWorkRequestBuilder<HealthConnectSyncWorker>()
                .setInputData(androidx.work.workDataOf(HealthConnectSyncWorker.KEY_FORCE_BACKFILL to true))
                .build()
            WorkManager.getInstance(this).enqueue(workRequest)
            Toast.makeText(this, "30-day backfill started...", Toast.LENGTH_SHORT).show()
        }
    }

    private fun scheduleDailySync() {
        val periodicWork = PeriodicWorkRequestBuilder<HealthConnectSyncWorker>(6, TimeUnit.HOURS)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "NadirHealthConnectSync",
            ExistingPeriodicWorkPolicy.KEEP,
            periodicWork
        )
    }
}
