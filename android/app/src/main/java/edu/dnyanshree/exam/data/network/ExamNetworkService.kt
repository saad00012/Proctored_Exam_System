package edu.dnyanshree.exam.data.network

import org.json.JSONObject
import java.io.OutputStreamWriter
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import edu.dnyanshree.exam.BuildConfig

class ExamNetworkService(
    private val baseUrl: String = BuildConfig.API_BASE_URL
) {
    suspend fun makeApiRequest(endpoint: String, method: String, jsonBody: String, authToken: String? = null): JSONObject = withContext(Dispatchers.IO) {
        try {
            val url = URL("$baseUrl$endpoint")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = method
            conn.connectTimeout = 2500
            conn.readTimeout = 2500
            conn.doInput = true
            conn.setRequestProperty("Content-Type", "application/json")
            if (authToken != null) {
                conn.setRequestProperty("Authorization", "Bearer $authToken")
            }

            if (method == "POST" || method == "PUT") {
                conn.doOutput = true
                OutputStreamWriter(conn.outputStream).use { writer ->
                    writer.write(jsonBody)
                    writer.flush()
                }
            }

            val responseCode = conn.responseCode
            val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
            val responseText = stream.bufferedReader().use { it.readText() }
            
            if (responseCode !in 200..299) {
                val errorJson = try { JSONObject(responseText) } catch(e: Exception) { null }
                val errorMsg = errorJson?.optString("error") ?: "Server returned error code $responseCode"
                throw Exception(errorMsg)
            }

            return@withContext JSONObject(responseText)
        } catch (e: IOException) {
            throw Exception("Cannot connect to proctoring backend server.", e)
        }
    }
}
