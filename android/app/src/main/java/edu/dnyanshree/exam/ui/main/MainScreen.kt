package edu.dnyanshree.exam.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import android.content.Context
import androidx.compose.ui.platform.LocalContext
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import android.content.Intent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import edu.dnyanshree.exam.MyDeviceAdminReceiver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import edu.dnyanshree.exam.data.network.ExamNetworkService
import org.json.JSONObject
import org.json.JSONArray
import edu.dnyanshree.exam.BuildConfig

// Data models for the Lobby grouped by Subject
data class ExamPaperItem(
    val id: String, // The subject name
    val title: String, // Display title (Subject name)
    val subject: String, // Description (e.g., "Contains 4 papers")
    val userStatus: String, // "unstarted", "started", "submitted", "blocked", "exhausted"
    val targetPaperId: String // The exact paper ID the student must take (either first or new unused one)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onStartExam: (String) -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val firestore = remember { FirebaseFirestore.getInstance() }
    val auth = remember { FirebaseAuth.getInstance() }
    val currentUser = auth.currentUser
    val studentId = currentUser?.uid ?: "mock-student-uid"
    val coroutineScope = rememberCoroutineScope()
    val networkService = remember { ExamNetworkService() }

    var examsList by remember { mutableStateOf<List<ExamPaperItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var refreshTrigger by remember { mutableStateOf(0) }

    var studentName by remember { mutableStateOf("Student") }
    var studentEmail by remember { mutableStateOf("") }
    var studentCourse by remember { mutableStateOf("N/A") }
    var studentSemester by remember { mutableStateOf("N/A") }

    var showWarningDialog by remember { mutableStateOf(false) }
    var activeWarningCount by remember { mutableStateOf(0) }
    var activeWarningThreshold by remember { mutableStateOf(3) }
    var activeWarningSubject by remember { mutableStateOf("") }
    var activeViolationIdState by remember { mutableStateOf("") }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                refreshTrigger++
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Fetch published papers and group them by subject
    LaunchedEffect(refreshTrigger) {
        loading = true
        try {
            // Fetch student profile details
            studentEmail = currentUser?.email ?: ""
            if (currentUser != null) {
                try {
                    val userDoc = firestore.collection("users").document(studentId).get().await()
                    if (userDoc.exists()) {
                        studentName = userDoc.getString("name") ?: "Student"
                        studentCourse = userDoc.getString("course") ?: "N/A"
                        studentSemester = userDoc.getString("semester") ?: "N/A"
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            // 1. Fetch all published papers
            val papersSnapshot = firestore.collection("papers")
                .whereEqualTo("status", "published")
                .get()
                .await()

            // 2. Fetch all attempts by this student
            val attemptsSnapshot = firestore.collection("exam_attempts")
                .whereEqualTo("studentId", studentId)
                .get()
                .await()

            // Fetch warning threshold dynamically from config
            var warningThreshold = 3
            try {
                val configDoc = firestore.collection("settings").document("config").get().await()
                if (configDoc.exists()) {
                    warningThreshold = configDoc.getLong("warningThreshold")?.toInt() ?: 3
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            // Find the latest attempt that ended in violation to trigger popups
            val violationAttempts = attemptsSnapshot.documents.filter { doc ->
                doc.getString("status") == "exited_on_violation"
            }.sortedByDescending { doc ->
                try {
                    doc.getTimestamp("startedAt") ?: com.google.firebase.Timestamp.now()
                } catch (e: Exception) {
                    com.google.firebase.Timestamp.now()
                }
            }

            val latestViolation = violationAttempts.firstOrNull()
            if (latestViolation != null) {
                val violationAttemptId = latestViolation.id
                val paperId = latestViolation.getString("paperId") ?: ""
                val paperDoc = papersSnapshot.documents.firstOrNull { it.id == paperId }
                val violationSubject = paperDoc?.getString("subject") ?: ""

                if (violationSubject.isNotEmpty()) {
                    // Calculate cumulative warnings for this subject
                    val subjectPaperIds = papersSnapshot.documents.filter { doc ->
                        doc.getString("subject") == violationSubject
                    }.map { it.id }

                    val subjectAttempts = attemptsSnapshot.documents.filter { doc ->
                        val attemptPaperId = doc.getString("paperId") ?: ""
                        subjectPaperIds.contains(attemptPaperId)
                    }

                    val cumulativeWarnings = subjectAttempts.sumOf { doc ->
                        doc.getLong("warnings")?.toInt() ?: 0
                    }

                    val prefs = context.getSharedPreferences("exam_prefs", Context.MODE_PRIVATE)
                    val lastAck = prefs.getString("last_ack_violation", "")
                    if (lastAck != violationAttemptId) {
                        activeWarningCount = cumulativeWarnings
                        activeWarningThreshold = warningThreshold
                        activeWarningSubject = violationSubject
                        activeViolationIdState = violationAttemptId
                        showWarningDialog = true
                    }
                }
            }

            // Map paperId -> status
            val attemptStatuses = attemptsSnapshot.documents.associate { doc ->
                val pId = doc.getString("paperId") ?: ""
                val status = doc.getString("status") ?: "started"
                pId to status
            }

            // Group published papers by subject
            val papersBySubject = papersSnapshot.documents.groupBy { doc ->
                doc.getString("subject") ?: ""
            }

            val items = mutableListOf<ExamPaperItem>()

            papersBySubject.forEach { (subject, subjectPapers) ->
                if (subject.isEmpty()) return@forEach

                // Find all attempts by the student for papers in this subject
                val subjectPaperIds = subjectPapers.map { it.id }
                val subjectAttempts = attemptsSnapshot.documents.filter { doc ->
                    val attemptPaperId = doc.getString("paperId") ?: ""
                    subjectPaperIds.contains(attemptPaperId)
                }

                // Check statuses of attempts
                val isBlocked = subjectAttempts.any { it.getString("status") == "blocked_pending_review" }
                val isSubmitted = subjectAttempts.any { it.getString("status") == "submitted" }
                val isMalpractice = subjectAttempts.any { it.getString("status") == "malpractice_failed" }
                val activeAttempt = subjectAttempts.firstOrNull { it.getString("status") == "started" }
                val violationAttempt = subjectAttempts.firstOrNull { it.getString("status") == "exited_on_violation" }

                var finalStatus = "unstarted"
                var targetPaper = subjectPapers.first().id // Default to first paper in subject

                 when {
                    isBlocked -> {
                        finalStatus = "blocked"
                    }
                    isMalpractice -> {
                        finalStatus = "failed"
                    }
                    activeAttempt != null -> {
                        finalStatus = "started"
                        targetPaper = activeAttempt.getString("paperId") ?: ""
                    }
                    violationAttempt != null -> {
                        // Find next unused paper (one that has no attempt record by student)
                        val attemptedPaperIds = subjectAttempts.map { it.getString("paperId") ?: "" }
                        val unusedPaper = subjectPapers.firstOrNull { doc ->
                            !attemptedPaperIds.contains(doc.id)
                        }
                        if (unusedPaper != null) {
                            finalStatus = "unstarted" // Prompt start of new paper
                            targetPaper = unusedPaper.id
                        } else {
                            finalStatus = "unstarted" // Resume the same paper since it was overridden
                            targetPaper = violationAttempt.getString("paperId") ?: ""
                        }
                    }
                    else -> {
                        // Find next unused paper (one that has no attempt record by student)
                        val attemptedPaperIds = subjectAttempts.map { it.getString("paperId") ?: "" }
                        val unusedPaper = subjectPapers.firstOrNull { doc ->
                            !attemptedPaperIds.contains(doc.id)
                        }
                        if (unusedPaper != null) {
                            finalStatus = "unstarted"
                            targetPaper = unusedPaper.id
                        } else {
                            finalStatus = "submitted" // All papers completed
                        }
                    }
                }

                items.add(
                    ExamPaperItem(
                        id = subject,
                        title = subject,
                        subject = "Exam pool contains ${subjectPapers.size} sets",
                        userStatus = finalStatus,
                        targetPaperId = targetPaper
                    )
                )
            }

            examsList = items
        } catch (e: Exception) {
            e.printStackTrace()
            // Server-connected fallback allocation for mock/offline mode
            try {
                val papersResp = networkService.makeApiRequest("/papers", "GET", "")
                val papersArray = papersResp.optJSONArray("papers")
                
                val monitorResp = networkService.makeApiRequest("/teacher/live-monitor", "GET", "")
                val attemptsArray = monitorResp.optJSONArray("activeSessions")
                
                val serverPapers = mutableListOf<Triple<String, String, String>>() // id, title, subject
                if (papersArray != null) {
                    for (i in 0 until papersArray.length()) {
                        val p = papersArray.getJSONObject(i)
                        val rawSubj = p.optString("subject", "Computer Science")
                        val normSubj = when (rawSubj.lowercase().trim()) {
                            "cse" -> "Computer Science"
                            "ee" -> "Electrical Engineering"
                            "mech" -> "Mechanical Engineering"
                            else -> rawSubj
                        }
                        serverPapers.add(Triple(p.getString("id"), p.optString("title", "Paper"), normSubj))
                    }
                }
                
                val subjectAttemptsList = mutableListOf<JSONObject>()
                if (attemptsArray != null) {
                    for (i in 0 until attemptsArray.length()) {
                        val att = attemptsArray.getJSONObject(i)
                        val attStudentId = att.optString("studentId")
                        if (attStudentId == studentId || attStudentId == "mock-uid-student-123" || currentUser == null) {
                            subjectAttemptsList.add(att)
                        }
                    }
                }
                
                val groupedBySubject = serverPapers.groupBy { it.third }
                val items = mutableListOf<ExamPaperItem>()
                
                groupedBySubject.forEach { (subj, pList) ->
                    val pIds = pList.map { it.first }
                    val subjectAttempts = subjectAttemptsList.filter { pIds.contains(it.optString("paperId")) }
                    
                    val isBlocked = subjectAttempts.any { it.optString("status") == "blocked_pending_review" }
                    val isFailed = subjectAttempts.any { it.optString("status") == "malpractice_failed" }
                    val activeAttempt = subjectAttempts.firstOrNull { it.optString("status") == "started" }
                    val violationAttempt = subjectAttempts.firstOrNull { it.optString("status") == "exited_on_violation" }
                    
                    val attemptedPaperIds = subjectAttempts.map { it.optString("paperId") }
                    val unusedPaper = pList.firstOrNull { !attemptedPaperIds.contains(it.first) }
                    
                    var finalStatus = "unstarted"
                    var targetPaper = pList.first().first
                    
                    when {
                        isBlocked -> {
                            finalStatus = "blocked"
                        }
                        isFailed -> {
                            finalStatus = "failed"
                        }
                        activeAttempt != null -> {
                            finalStatus = "started"
                            targetPaper = activeAttempt.optString("paperId")
                        }
                        violationAttempt != null -> {
                            if (unusedPaper != null) {
                                finalStatus = "unstarted"
                                targetPaper = unusedPaper.first
                            } else {
                                finalStatus = "unstarted"
                                targetPaper = violationAttempt.optString("paperId")
                            }
                        }
                        else -> {
                            if (unusedPaper != null) {
                                finalStatus = "unstarted"
                                targetPaper = unusedPaper.first
                            } else {
                                finalStatus = "submitted"
                            }
                        }
                    }
                    items.add(ExamPaperItem(subj, subj, "Exam pool contains ${pList.size} sets", finalStatus, targetPaper))
                }
                
                examsList = if (items.isNotEmpty()) items else listOf(
                    ExamPaperItem("Computer Science", "Computer Science", "Exam pool contains 3 sets", "unstarted", "cse-set-a"),
                    ExamPaperItem("Electrical Engineering", "Electrical Engineering", "Exam pool contains 1 set", "unstarted", "ee-set-a")
                )
            } catch (_: Exception) {
                examsList = listOf(
                    ExamPaperItem("Computer Science", "Computer Science", "Exam pool contains 3 sets", "unstarted", "cse-set-a"),
                    ExamPaperItem("Electrical Engineering", "Electrical Engineering", "Exam pool contains 1 set", "unstarted", "ee-set-a")
                )
            }
        } finally {
            loading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("DIET Proctored Exam Portal", fontSize = 18.sp, fontWeight = FontWeight.Bold) },
                actions = {
                    TextButton(onClick = onLogout) {
                        Text("Log Out", color = MaterialTheme.colorScheme.error)
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = modifier
                .padding(innerPadding)
                .fillMaxSize()
        ) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else {
                Column(
                    modifier = Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Premium Profile Card Header
                    val devicePolicyManager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
                    val adminComponent = ComponentName(context, MyDeviceAdminReceiver::class.java)
                    val isDeviceAdminActive = devicePolicyManager.isAdminActive(adminComponent)

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f)
                        ),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.25f))
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = studentName,
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Text(
                                        text = studentEmail,
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                
                                // Device Admin Status Badge
                                Box(
                                    modifier = Modifier
                                        .background(
                                            color = if (isDeviceAdminActive) {
                                                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                                            } else {
                                                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
                                            },
                                            shape = RoundedCornerShape(20.dp)
                                        )
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Icon(
                                            imageVector = if (isDeviceAdminActive) {
                                                Icons.Default.CheckCircle
                                            } else {
                                                Icons.Default.Warning
                                            },
                                            contentDescription = null,
                                            tint = if (isDeviceAdminActive) {
                                                MaterialTheme.colorScheme.primary
                                            } else {
                                                MaterialTheme.colorScheme.error
                                            },
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Text(
                                            text = if (isDeviceAdminActive) "Protected" else "Action Needed",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isDeviceAdminActive) {
                                                MaterialTheme.colorScheme.onPrimaryContainer
                                            } else {
                                                MaterialTheme.colorScheme.onErrorContainer
                                            }
                                        )
                                    }
                                }
                            }
                            
                            Spacer(modifier = Modifier.height(12.dp))
                            HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
                            Spacer(modifier = Modifier.height(10.dp))
                            
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "COURSE / BRANCH",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                                    )
                                    Text(
                                        text = studentCourse,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "CURRENT SEMESTER",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                                    )
                                    Text(
                                        text = studentSemester,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }
                            
                            if (!isDeviceAdminActive) {
                                Spacer(modifier = Modifier.height(12.dp))
                                Button(
                                    onClick = {
                                        val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                                            putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                                            putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Activate device admin to lock exam app task screen and sit for proctored exams.")
                                        }
                                        context.startActivity(intent)
                                    },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = MaterialTheme.colorScheme.error,
                                        contentColor = MaterialTheme.colorScheme.onError
                                    ),
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Activate Device Admin", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Assigned Examinations", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (BuildConfig.DEBUG) {
                                Button(
                                    onClick = {
                                        coroutineScope.launch {
                                            try {
                                                loading = true
                                                val snapshot = firestore.collection("exam_attempts")
                                                    .whereEqualTo("studentId", studentId)
                                                    .get()
                                                    .await()
                                                snapshot.documents.forEach { doc ->
                                                    firestore.collection("exam_attempts").document(doc.id).delete().await()
                                                }
                                                refreshTrigger++
                                            } catch (e: Exception) {
                                                e.printStackTrace()
                                            } finally {
                                                loading = false
                                            }
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = MaterialTheme.colorScheme.errorContainer,
                                        contentColor = MaterialTheme.colorScheme.onErrorContainer
                                    )
                                ) {
                                    Text("🛠️ Dev Reset")
                                }
                            }

                            Button(
                                onClick = { refreshTrigger++ },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surfaceVariant, contentColor = MaterialTheme.colorScheme.onSurfaceVariant)
                            ) {
                                Text("Refresh")
                            }
                        }
                    }

                    if (examsList.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "No active examinations found.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            items(examsList) { exam ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(14.dp),
                                    border = BorderStroke(
                                        width = 1.dp,
                                        color = when (exam.userStatus) {
                                            "blocked", "failed" -> MaterialTheme.colorScheme.error.copy(alpha = 0.25f)
                                            "submitted" -> MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)
                                            "started" -> MaterialTheme.colorScheme.tertiary.copy(alpha = 0.25f)
                                            else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)
                                        }
                                    )
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(exam.title, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(exam.subject, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }

                                        Spacer(modifier = Modifier.width(16.dp))

                                        // Action Button based on status
                                        when (exam.userStatus) {
                                            "submitted" -> {
                                                Button(
                                                    onClick = {},
                                                    enabled = false,
                                                    colors = ButtonDefaults.buttonColors(
                                                        disabledContainerColor = MaterialTheme.colorScheme.outlineVariant,
                                                        disabledContentColor = MaterialTheme.colorScheme.outline
                                                    )
                                                ) {
                                                    Text("Submitted")
                                                }
                                            }
                                            "started" -> {
                                                Button(
                                                    onClick = { onStartExam(exam.targetPaperId) },
                                                    colors = ButtonDefaults.buttonColors(
                                                        containerColor = MaterialTheme.colorScheme.tertiary,
                                                        contentColor = MaterialTheme.colorScheme.onTertiary
                                                    )
                                                ) {
                                                    Text("Resume")
                                                }
                                            }
                                            "blocked" -> {
                                                Button(
                                                    onClick = {},
                                                    enabled = false,
                                                    colors = ButtonDefaults.buttonColors(
                                                        disabledContainerColor = MaterialTheme.colorScheme.errorContainer,
                                                        disabledContentColor = MaterialTheme.colorScheme.error
                                                    )
                                                ) {
                                                    Text("Blocked")
                                                }
                                            }
                                            "failed" -> {
                                                Button(
                                                    onClick = {},
                                                    enabled = false,
                                                    colors = ButtonDefaults.buttonColors(
                                                        disabledContainerColor = MaterialTheme.colorScheme.errorContainer,
                                                        disabledContentColor = MaterialTheme.colorScheme.error
                                                    )
                                                ) {
                                                    Text("Failed (Malpractice)")
                                                }
                                            }
                                            "exhausted" -> {
                                                Button(
                                                    onClick = {},
                                                    enabled = false,
                                                    colors = ButtonDefaults.buttonColors(
                                                        disabledContainerColor = MaterialTheme.colorScheme.outlineVariant,
                                                        disabledContentColor = MaterialTheme.colorScheme.outline
                                                    )
                                                ) {
                                                    Text("Exhausted")
                                                }
                                            }
                                            else -> {
                                                Button(
                                                    onClick = { onStartExam(exam.targetPaperId) }
                                                ) {
                                                    Text("Start")
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showWarningDialog) {
        AlertDialog(
            onDismissRequest = { /* Force explicit accept */ },
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = "Warning Icon",
                        tint = MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = "Malpractice Warning",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "A focus loss violation (app minimization or switching) was detected during your recent attempt on subject: $activeWarningSubject.",
                        fontSize = 14.sp
                    )
                    
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f),
                                shape = RoundedCornerShape(8.dp)
                            )
                            .padding(16.dp)
                    ) {
                        Column {
                            Text(
                                text = "Warnings Recorded: $activeWarningCount of $activeWarningThreshold",
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                fontSize = 16.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            val remaining = activeWarningThreshold - activeWarningCount
                            Text(
                                text = if (remaining > 0) {
                                    "Caution: You have $remaining warning${if (remaining > 1) "s" else ""} left. If you minimize the app again, your account will be locked."
                                } else {
                                    "Your account is now blocked pending review."
                                },
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.8f)
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val prefs = context.getSharedPreferences("exam_prefs", Context.MODE_PRIVATE)
                        prefs.edit().putString("last_ack_violation", activeViolationIdState).apply()
                        showWarningDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("I Understand")
                }
            }
        )
    }
}
