package edu.dnyanshree.exam.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.foundation.shape.RoundedCornerShape
import java.time.OffsetDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

data class ResultItem(
    val attemptId: String,
    val title: String,
    val subject: String,
    val department: String,
    val semester: String,
    val score: Long?,
    val totalQuestions: Long?,
    val submittedAt: String,
    val warnings: Long,
    val elapsedTime: Long
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ResultHistoryScreen(onBack: () -> Unit) {
    val firestore = remember { FirebaseFirestore.getInstance() }
    val auth = remember { FirebaseAuth.getInstance() }
    val studentId = auth.currentUser?.uid ?: ""

    var results by remember { mutableStateOf<List<ResultItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(studentId) {
        if (studentId.isEmpty()) {
            loading = false
            return@LaunchedEffect
        }
        try {
            val attemptsSnapshot = firestore.collection("exam_attempts")
                .whereEqualTo("studentId", studentId)
                .whereEqualTo("status", "submitted")
                .get()
                .await()

            val fetchedResults = mutableListOf<ResultItem>()
            for (doc in attemptsSnapshot.documents) {
                val paperId = doc.getString("paperId") ?: continue
                val score = doc.getLong("score")
                val totalQuestions = doc.getLong("totalQuestions")
                val submittedAt = doc.getString("submittedAt") ?: ""
                val warnings = doc.getLong("warnings") ?: 0L
                val elapsedTime = doc.getLong("elapsedTime") ?: 0L

                val paperDoc = try {
                    firestore.collection("papers").document(paperId).get().await()
                } catch (e: Exception) { null }

                if (paperDoc != null && paperDoc.exists()) {
                    val title = paperDoc.getString("title") ?: "Unknown Title"
                    val subject = paperDoc.getString("subject") ?: "Unknown Subject"
                    val department = paperDoc.getString("department") ?: ""
                    val semester = paperDoc.getString("semester") ?: ""

                    fetchedResults.add(
                        ResultItem(
                            attemptId = doc.id,
                            title = title,
                            subject = subject,
                            department = department,
                            semester = semester,
                            score = score,
                            totalQuestions = totalQuestions,
                            submittedAt = submittedAt,
                            warnings = warnings,
                            elapsedTime = elapsedTime
                        )
                    )
                }
            }
            // Sort by submittedAt descending
            results = fetchedResults.sortedByDescending { it.submittedAt }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            loading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Results", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
        ) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else if (results.isEmpty()) {
                Text(
                    text = "No completed exams yet.",
                    modifier = Modifier.align(Alignment.Center),
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(results) { result ->
                        ResultCard(result)
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultCard(result: ResultItem) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "${result.title} - ${result.subject}",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (result.department.isNotBlank()) {
                    SuggestionChip(
                        onClick = {},
                        label = { Text(result.department, fontSize = 11.sp) }
                    )
                }
                if (result.semester.isNotBlank()) {
                    SuggestionChip(
                        onClick = {},
                        label = { Text(result.semester, fontSize = 11.sp) }
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            
            val percentage = if (result.score != null && result.totalQuestions != null && result.totalQuestions > 0) {
                (result.score.toFloat() / result.totalQuestions.toFloat()) * 100f
            } else {
                null
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (result.score != null) {
                    Text(
                        text = "Score: ${result.score}${if (result.totalQuestions != null) "/${result.totalQuestions}" else ""}",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                } else {
                    Text(
                        text = "Score not available",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (percentage != null) {
                    val isPass = percentage >= 40f
                    val badgeColor = if (isPass) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer
                    val badgeTextColor = if (isPass) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                    
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = badgeColor,
                        modifier = Modifier.padding(start = 8.dp)
                    ) {
                        Text(
                            text = if (isPass) "PASSED" else "FAILED",
                            color = badgeTextColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            if (percentage != null) {
                Spacer(modifier = Modifier.height(8.dp))
                val progressColor = if (percentage >= 40f) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                LinearProgressIndicator(
                    progress = { percentage / 100f },
                    color = progressColor,
                    trackColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f),
                    modifier = Modifier.fillMaxWidth().height(6.dp),
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Formatted date
            val formattedDate = remember(result.submittedAt) {
                try {
                    val outFmt = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm", Locale.ENGLISH)
                    if (result.submittedAt.contains("T")) {
                        try {
                            OffsetDateTime.parse(result.submittedAt).format(outFmt)
                        } catch (e: Exception) {
                            ZonedDateTime.parse(result.submittedAt).format(outFmt)
                        }
                    } else {
                        result.submittedAt
                    }
                } catch (e: Exception) {
                    result.submittedAt
                }
            }

            Text(
                text = "Submitted: $formattedDate",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (result.warnings > 0) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Warnings: ${result.warnings}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.error,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
