package edu.dnyanshree.exam.data.repository

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import edu.dnyanshree.exam.data.network.ExamNetworkService

data class PendingAnswer(
    val questionId: String,
    val selectedOptionIndex: Int,
    val timestamp: Long
)

class OfflineAnswerManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("offline_exam_vault", Context.MODE_PRIVATE)

    /**
     * Atomically commits an answer to local persistent storage (< 3ms).
     * Returns true on success.
     */
    fun saveAnswerLocally(paperId: String, questionId: String, selectedOptionIndex: Int): Boolean {
        return try {
            // 1. Update active answer map
            val answersKey = "answers_$paperId"
            val existingAnswersJson = prefs.getString(answersKey, "{}") ?: "{}"
            val answersObj = JSONObject(existingAnswersJson)
            answersObj.put(questionId, selectedOptionIndex)

            // 2. Add or update pending sync queue
            val queueKey = "queue_$paperId"
            val existingQueueJson = prefs.getString(queueKey, "[]") ?: "[]"
            val queueArr = JSONArray(existingQueueJson)

            // Replace existing question entry in queue or append
            val newQueueArr = JSONArray()
            var replaced = false
            for (i in 0 until queueArr.length()) {
                val item = queueArr.getJSONObject(i)
                if (item.optString("questionId") == questionId) {
                    val updated = JSONObject().apply {
                        put("questionId", questionId)
                        put("selectedOptionIndex", selectedOptionIndex)
                        put("timestamp", System.currentTimeMillis())
                    }
                    newQueueArr.put(updated)
                    replaced = true
                } else {
                    newQueueArr.put(item)
                }
            }
            if (!replaced) {
                val newItem = JSONObject().apply {
                    put("questionId", questionId)
                    put("selectedOptionIndex", selectedOptionIndex)
                    put("timestamp", System.currentTimeMillis())
                }
                newQueueArr.put(newItem)
            }

            prefs.edit()
                .putString(answersKey, answersObj.toString())
                .putString(queueKey, newQueueArr.toString())
                .apply()
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Retrieves all saved answers for an exam paper (offline-first).
     */
    fun getLocalAnswers(paperId: String): Map<String, Int> {
        return try {
            val answersKey = "answers_$paperId"
            val jsonStr = prefs.getString(answersKey, "{}") ?: "{}"
            val obj = JSONObject(jsonStr)
            val map = mutableMapOf<String, Int>()
            val keys = obj.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                map[key] = obj.getInt(key)
            }
            map
        } catch (_: Exception) {
            emptyMap()
        }
    }

    /**
     * Gets the count of pending un-synced answers in local storage.
     */
    fun getPendingCount(paperId: String): Int {
        return try {
            val queueKey = "queue_$paperId"
            val jsonStr = prefs.getString(queueKey, "[]") ?: "[]"
            JSONArray(jsonStr).length()
        } catch (_: Exception) {
            0
        }
    }

    /**
     * Drains the pending answer queue to the server via batch endpoint.
     * Returns the count of answers successfully synced.
     */
    suspend fun drainQueueToServer(
        paperId: String,
        networkService: ExamNetworkService,
        authToken: String
    ): Int = withContext(Dispatchers.IO) {
        val queueKey = "queue_$paperId"
        val jsonStr = prefs.getString(queueKey, "[]") ?: "[]"
        val queueArr = JSONArray(jsonStr)
        if (queueArr.length() == 0) return@withContext 0

        val answersArray = JSONArray()
        val questionIdsInBatch = mutableListOf<String>()

        for (i in 0 until queueArr.length()) {
            val item = queueArr.getJSONObject(i)
            answersArray.put(item)
            questionIdsInBatch.add(item.getString("questionId"))
        }

        val requestBody = JSONObject().apply {
            put("paperId", paperId)
            put("answers", answersArray)
        }.toString()

        try {
            val response = networkService.makeApiRequest(
                endpoint = "/sync-batch-answers",
                method = "POST",
                jsonBody = requestBody,
                authToken = authToken,
                maxRetries = 2
            )
            val syncedCount = response.optInt("syncedCount", questionIdsInBatch.size)

            // Remove synced answers from queue
            val remainingQueue = JSONArray()
            val freshJsonStr = prefs.getString(queueKey, "[]") ?: "[]"
            val currentQueueArr = JSONArray(freshJsonStr)
            for (i in 0 until currentQueueArr.length()) {
                val item = currentQueueArr.getJSONObject(i)
                val qId = item.getString("questionId")
                if (!questionIdsInBatch.contains(qId)) {
                    remainingQueue.put(item)
                }
            }
            prefs.edit().putString(queueKey, remainingQueue.toString()).apply()

            syncedCount
        } catch (e: Exception) {
            0
        }
    }

    /**
     * Cleans up local vault storage for a completed/submitted paper.
     */
    fun clearPaperData(paperId: String) {
        prefs.edit()
            .remove("answers_$paperId")
            .remove("queue_$paperId")
            .apply()
    }
}
