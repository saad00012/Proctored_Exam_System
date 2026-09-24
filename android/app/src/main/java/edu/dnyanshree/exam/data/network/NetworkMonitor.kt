package edu.dnyanshree.exam.data.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.net.HttpURLConnection
import java.net.URL
import edu.dnyanshree.exam.BuildConfig

data class NetworkStatus(
    val isConnected: Boolean = true,
    val latencyMs: Long = 0L,
    val isDegraded: Boolean = false,
    val offlineDurationSeconds: Long = 0L
)

class NetworkMonitor(
    private val context: Context,
    private val coroutineScope: CoroutineScope
) {
    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _networkStatus = MutableStateFlow(NetworkStatus(isConnected = true))
    val networkStatus: StateFlow<NetworkStatus> = _networkStatus.asStateFlow()

    private var pingJob: Job? = null
    private var offlineStartTime: Long? = null

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            offlineStartTime = null
            _networkStatus.value = _networkStatus.value.copy(
                isConnected = true,
                offlineDurationSeconds = 0L
            )
            measurePing()
        }

        override fun onLost(network: Network) {
            if (offlineStartTime == null) {
                offlineStartTime = System.currentTimeMillis()
            }
            _networkStatus.value = _networkStatus.value.copy(
                isConnected = false,
                isDegraded = true
            )
        }

        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
            val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            val isValidated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            val isStrong = hasInternet && isValidated
            
            _networkStatus.value = _networkStatus.value.copy(
                isConnected = hasInternet,
                isDegraded = !isStrong
            )
        }
    }

    fun startMonitoring() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        try {
            connectivityManager.registerNetworkCallback(request, networkCallback)
        } catch (_: Exception) {
            // Safe fallback on restricted devices
        }

        // Periodic ping and offline duration ticker
        pingJob = coroutineScope.launch(Dispatchers.IO) {
            while (isActive) {
                if (_networkStatus.value.isConnected) {
                    measurePing()
                } else {
                    val start = offlineStartTime ?: System.currentTimeMillis()
                    val durationSec = (System.currentTimeMillis() - start) / 1000L
                    _networkStatus.value = _networkStatus.value.copy(
                        offlineDurationSeconds = durationSec
                    )
                }
                delay(12000L) // Ping every 12 seconds
            }
        }
    }

    fun stopMonitoring() {
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (_: Exception) {}
        pingJob?.cancel()
    }

    private fun measurePing() {
        try {
            val startTime = System.currentTimeMillis()
            val url = URL("${BuildConfig.API_BASE_URL}/ping")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 4000
                readTimeout = 4000
                useCaches = false
            }
            val responseCode = conn.responseCode
            val endTime = System.currentTimeMillis()
            conn.disconnect()

            if (responseCode == 200) {
                val ping = endTime - startTime
                _networkStatus.value = _networkStatus.value.copy(
                    isConnected = true,
                    latencyMs = ping,
                    isDegraded = ping > 450L,
                    offlineDurationSeconds = 0L
                )
            }
        } catch (_: Exception) {
            _networkStatus.value = _networkStatus.value.copy(
                isDegraded = true
            )
        }
    }
}
