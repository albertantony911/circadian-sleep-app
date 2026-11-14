package com.nadir.sleep

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.appcompat.app.AppCompatActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.lifecycle.lifecycleScope
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.google.android.material.floatingactionbutton.FloatingActionButton
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var bannerPermission: LinearLayout
    private lateinit var btnGrantBanner: Button
    private lateinit var fabSync: FloatingActionButton

    private var healthConnectClient: HealthConnectClient? = null
    private lateinit var requestPermissionLauncher: ActivityResultLauncher<Set<String>>

    private val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(SleepSessionRecord::class)
    )

    companion object {
        const val APP_URL = "https://circadian-sleep-app.vercel.app"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Set status and navigation bar color to deep OLED black
        window.statusBarColor = Color.parseColor("#09090B")
        window.navigationBarColor = Color.parseColor("#09090B")

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        bannerPermission = findViewById(R.id.bannerPermission)
        btnGrantBanner = findViewById(R.id.btnGrantBanner)
        fabSync = findViewById(R.id.fabSync)

        setupHealthConnect()
        setupWebView()
        setupSwipeRefresh()
        setupFab()
        setupBackNavigation()

        checkPermissionsAndSchedule()

        // Load Nadir PWA
        webView.loadUrl(APP_URL)
    }

    private fun setupHealthConnect() {
        val providerPackageName = "com.google.android.apps.healthdata"
        val availabilityStatus = HealthConnectClient.getSdkStatus(this, providerPackageName)

        healthConnectClient = try {
            HealthConnectClient.getOrCreate(this, providerPackageName)
        } catch (e: Exception) {
            try {
                HealthConnectClient.getOrCreate(this)
            } catch (ex: Exception) {
                null
            }
        }

        requestPermissionLauncher = registerForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { granted ->
            if (granted.containsAll(PERMISSIONS)) {
                bannerPermission.visibility = View.GONE
                scheduleDailySync()
                Toast.makeText(this, "✓ Health Connect permissions granted!", Toast.LENGTH_SHORT).show()
                triggerDeltaSync()
            } else {
                bannerPermission.visibility = View.VISIBLE
                Toast.makeText(this, "⚠️ Sleep permissions required to sync records", Toast.LENGTH_LONG).show()
            }
        }

        btnGrantBanner.setOnClickListener {
            if (healthConnectClient == null) {
                Toast.makeText(this, "Health Connect service not available", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            requestPermissionLauncher.launch(PERMISSIONS)
        }
    }

    private fun checkPermissionsAndSchedule() {
        val client = healthConnectClient ?: return
        lifecycleScope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(PERMISSIONS)) {
                    bannerPermission.visibility = View.GONE
                    scheduleDailySync()
                } else {
                    bannerPermission.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.setBackgroundColor(Color.parseColor("#09090B"))

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            mediaPlaybackRequiresUserGesture = false
            userAgentString = "$userAgentString NadirUnifiedApp/1.0"
        }

        webView.addJavascriptInterface(NadirNativeBridge(this), "NadirNative")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return if (url.startsWith(APP_URL) || url.startsWith("https://circadian-sleep-app.vercel.app")) {
                    false
                } else {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    true
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                swipeRefresh.isRefreshing = false
            }
        }

        webView.webChromeClient = WebChromeClient()
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setColorSchemeColors(
            Color.parseColor("#A78BFA"),
            Color.parseColor("#8B5CF6")
        )
        swipeRefresh.setProgressBackgroundColorSchemeColor(Color.parseColor("#18181B"))
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    private fun setupFab() {
        fabSync.setOnClickListener {
            Toast.makeText(this, "Syncing Health Connect delta...", Toast.LENGTH_SHORT).show()
            triggerDeltaSync()
        }

        fabSync.setOnLongClickListener {
            Toast.makeText(this, "Backfilling 30 days from Health Connect...", Toast.LENGTH_LONG).show()
            triggerBackfill()
            true
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    fun triggerDeltaSync() {
        val workRequest = OneTimeWorkRequestBuilder<HealthConnectSyncWorker>().build()
        val workManager = WorkManager.getInstance(this)
        workManager.enqueue(workRequest)

        workManager.getWorkInfoByIdLiveData(workRequest.id).observe(this) { info ->
            if (info != null && info.state == WorkInfo.State.SUCCEEDED) {
                Toast.makeText(this, "✓ Sync complete! Updating dashboard...", Toast.LENGTH_SHORT).show()
                webView.reload()
            }
        }
    }

    fun triggerBackfill() {
        val workRequest = OneTimeWorkRequestBuilder<HealthConnectSyncWorker>()
            .setInputData(workDataOf(HealthConnectSyncWorker.KEY_FORCE_BACKFILL to true))
            .build()
        val workManager = WorkManager.getInstance(this)
        workManager.enqueue(workRequest)

        workManager.getWorkInfoByIdLiveData(workRequest.id).observe(this) { info ->
            if (info != null && info.state == WorkInfo.State.SUCCEEDED) {
                Toast.makeText(this, "✓ 30-day backfill complete!", Toast.LENGTH_SHORT).show()
                webView.reload()
            }
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

    class NadirNativeBridge(private val activity: MainActivity) {
        @JavascriptInterface
        fun triggerSync() {
            activity.runOnUiThread {
                activity.triggerDeltaSync()
            }
        }

        @JavascriptInterface
        fun isNativeApp(): Boolean = true
    }
}
