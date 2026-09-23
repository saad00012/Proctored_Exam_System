package edu.dnyanshree.exam.data.network

import org.json.JSONObject
import java.io.OutputStreamWriter
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import edu.dnyanshree.exam.BuildConfig

class ExamNetworkService(
    private val baseUrl: String = BuildConfig.API_BASE_URL
) {
    /**
     * Executes an HTTP request with automatic retry and exponential backoff on network failures.
     */
    suspend fun makeApiRequest(
        endpoint: String,
        method: String,
        jsonBody: String = "{}",
        authToken: String? = null,
        maxRetries: Int = 3
    ): JSONObject = withContext(Dispatchers.IO) {
        var currentAttempt = 0
        var lastException: Exception? = null

        while (currentAttempt < maxRetries) {
            try {
                return@withContext executeSingleRequest(endpoint, method, jsonBody, authToken)
            } catch (e: IOException) {
                lastException = e
                currentAttempt++
                if (currentAttempt < maxRetries) {
                    val backoffDelay = 1000L * (1L shl (currentAttempt - 1))
                    delay(backoffDelay)
                }
            }
        }

        throw Exception("Cannot connect to proctoring backend server after $maxRetries attempts.", lastException)
    }

    private fun executeSingleRequest(
        endpoint: String,
        method: String,
        jsonBody: String,
        authToken: String?
    ): JSONObject {
        val url = URL("$baseUrl$endpoint")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 30000
        conn.readTimeout = 30000
        conn.doInput = true
        conn.setRequestProperty("Content-Type", "application/json")
        if (authToken != null) {
            conn.setRequestProperty("Authorization", "Bearer $authToken")
        }

        if (method == "POST" || method == "PUT" || method == "DELETE") {
            if (jsonBody.isNotBlank() && jsonBody != "{}") {
                conn.doOutput = true
                OutputStreamWriter(conn.outputStream).use { writer ->
                    writer.write(jsonBody)
                    writer.flush()
                }
            }
        }

        val responseCode = conn.responseCode
        val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
        val responseText = stream?.bufferedReader()?.use { it.readText() } ?: ""

        if (responseCode !in 200..299) {
            val errorJson = try { JSONObject(responseText) } catch (_: Exception) { null }
            val errorMsg = errorJson?.optString("error") ?: "Server returned error code $responseCode"
            throw Exception(errorMsg)
        }

        return if (responseText.isNotBlank()) JSONObject(responseText) else JSONObject()
    }
}
