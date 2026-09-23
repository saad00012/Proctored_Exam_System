package edu.dnyanshree.exam.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import java.time.OffsetDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.SettingsBrightness
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import android.content.Intent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import edu.dnyanshree.exam.MyDeviceAdminReceiver
import edu.dnyanshree.exam.data.network.ExamNetworkService
import edu.dnyanshree.exam.data.model.ExamPaperItem
import edu.dnyanshree.exam.theme.ThemeManager
import edu.dnyanshree.exam.theme.ThemeMode
import org.json.JSONObject

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses an ISO-8601 date-time string (e.g. "2026-10-21T09:00:00+05:30" or
 * "2026-10-21 09:00:00 GMT+05:30") and returns a clean "21 Oct, 09:00" string.
 * Falls back to the raw value if parsing fails.
 */
private fun formatScheduleDateTime(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    val outFmt = DateTimeFormatter.ofPattern("d MMM, HH:mm", Locale.ENGLISH)
    // datetime-local input produces "2026-10-21T09:00" (no seconds, no timezone)
    try {
        return java.time.LocalDateTime.parse(raw, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"))
            .format(outFmt)
    } catch (_: Exception) {}
    // datetime-local with seconds: "2026-10-21T09:00:00"
    try {
        return java.time.LocalDateTime.parse(raw).format(outFmt)
    } catch (_: Exception) {}
    // ISO-8601 with timezone offset: "2026-10-21T09:00:00+05:30"
    try { return OffsetDateTime.parse(raw).format(outFmt) } catch (_: Exception) {}
    // ISO-8601 with zone ID
    try { return ZonedDateTime.parse(raw).format(outFmt) } catch (_: Exception) {}
    // Last resort: strip GMT/UTC offset text and return what's left
    val stripped = raw.replace(Regex("""(GMT|UTC)?[+\-]\d{1,2}:\d{2}"""), "").trim()
        .replace(Regex("""\s+Z$"""), "").trim()
    return stripped.ifBlank { raw }
}

/** Returns an Instant for schedule comparison, or null if unparseable. */
private fun parseScheduleInstant(raw: String?): java.time.Instant? {
    if (raw.isNullOrBlank()) return null
    // datetime-local: "2026-10-21T09:00" — treat as device local time
    try {
        return java.time.LocalDateTime
            .parse(raw, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"))
            .atZone(java.time.ZoneId.systemDefault())
            .toInstant()
    } catch (_: Exception) {}
    try {
        return java.time.LocalDateTime.parse(raw)
            .atZone(java.time.ZoneId.systemDefault())
            .toInstant()
    } catch (_: Exception) {}
    try { return OffsetDateTime.parse(raw).toInstant() } catch (_: Exception) {}
    try { return ZonedDateTime.parse(raw).toInstant() } catch (_: Exception) {}
    return null
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

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
    val studentId = currentUser?.uid ?: ""
    val coroutineScope = rememberCoroutineScope()
    val networkService = remember { ExamNetworkService() }

    var examsList by remember { mutableStateOf<List<ExamPaperItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var refreshTrigger by remember { mutableStateOf(0) }

    var studentName by remember { mutableStateOf("Student") }
    var studentEmail by remember { mutableStateOf("") }
    var studentCourse by remember { mutableStateOf("N/A") }
    var studentSemester by remember { mutableStateOf("N/A") }
    var studentPrn by remember { mutableStateOf("N/A") }

    var showProfileModal by remember { mutableStateOf(false) }
    var showWarningDialog by remember { mutableStateOf(false) }
    var activeWarningCount by remember { mutableStateOf(0) }
    var activeWarningThreshold by remember { mutableStateOf(3) }
    var activeWarningSubject by remember { mutableStateOf("") }
    var activeViolationIdState by remember { mutableStateOf("") }

    var selectedExamForOtp by remember { mutableStateOf<ExamPaperItem?>(null) }
    var otpInput by remember { mutableStateOf("") }
    var otpError by remember { mutableStateOf("") }

    val currentTheme = ThemeManager.currentThemeMode

    // Device admin state
    val devicePolicyManager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    val adminComponent = ComponentName(context, MyDeviceAdminReceiver::class.java)
    val isDeviceAdminActive = devicePolicyManager.isAdminActive(adminComponent)

    // Real-time listener: auto-refresh when teacher approves/denies blocked attempt
    DisposableEffect(studentId) {
        if (studentId.isEmpty()) return@DisposableEffect onDispose {}
        val reg = firestore.collection("exam_attempts")
            .whereEqualTo("studentId", studentId)
            .addSnapshotListener { snapshot, _ ->
                if (snapshot != null) refreshTrigger++
            }
        onDispose { reg.remove() }
    }

    // Fetch published papers and group by subject
    LaunchedEffect(refreshTrigger) {
        loading = true
        try {
            studentEmail = currentUser?.email ?: ""
            if (currentUser != null) {
                try {
                    val userDoc = firestore.collection("users").document(studentId).get().await()
                    if (userDoc.exists()) {
                        val fetched = userDoc.getString("name")?.takeIf { it.isNotBlank() && it != "Student" }
                        studentName = fetched ?: currentUser.displayName?.takeIf { it.isNotBlank() } ?: studentEmail.substringBefore("@")
                        studentCourse = userDoc.getString("department") ?: "N/A"
                        studentSemester = userDoc.getString("semester") ?: "N/A"
                        studentPrn = userDoc.getString("prnNumber") ?: "N/A"
                    } else {
                        val fallback = currentUser.displayName?.takeIf { it.isNotBlank() }
                            ?: (currentUser.email?.substringBefore("@") ?: "Student")
                        studentName = fallback
                        studentCourse = "Unassigned"
                        studentSemester = "N/A"
                        studentPrn = "N/A"
                        firestore.collection("users").document(studentId).set(
                            hashMapOf(
                                "uid" to studentId,
                                "name" to fallback,
                                "email" to (currentUser.email ?: ""),
                                "role" to "student",
                                "department" to "Unassigned",
                                "semester" to "N/A",
                                "prnNumber" to "N/A",
                                "collegeDomain" to (currentUser.email?.substringAfter("@") ?: ""),
                                "createdAt" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                            )
                        )
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    studentName = currentUser.displayName ?: (currentUser.email?.substringBefore("@") ?: "Student")
                }
            }

            val papersQuery = if (studentCourse != "N/A" && studentCourse.isNotEmpty() && studentCourse != "All") {
                firestore.collection("papers")
                    .whereEqualTo("status", "published")
                    .whereEqualTo("department", studentCourse)
            } else {
                firestore.collection("papers").whereEqualTo("status", "published")
            }
            val papersSnapshot = papersQuery.get().await()

            val attemptsSnapshot = firestore.collection("exam_attempts")
                .whereEqualTo("studentId", studentId)
                .get().await()

            var warningThreshold = 3
            try {
                val cfg = firestore.collection("settings").document("config").get().await()
                if (cfg.exists()) warningThreshold = cfg.getLong("warningThreshold")?.toInt() ?: 3
            } catch (_: Exception) {}

            val violationAttempts = attemptsSnapshot.documents
                .filter { it.getString("status") == "exited_on_violation" }
                .sortedByDescending {
                    try { it.getTimestamp("startedAt") ?: com.google.firebase.Timestamp.now() }
                    catch (_: Exception) { com.google.firebase.Timestamp.now() }
                }

            val latestViolation = violationAttempts.firstOrNull()
            if (latestViolation != null) {
                val violationAttemptId = latestViolation.id
                val paperId = latestViolation.getString("paperId") ?: ""
                val paperDoc = papersSnapshot.documents.firstOrNull { it.id == paperId }
                val violationSubject = paperDoc?.getString("subject") ?: ""
                if (violationSubject.isNotEmpty()) {
                    val subjectPaperIds = papersSnapshot.documents
                        .filter { it.getString("subject") == violationSubject }.map { it.id }
                    val subjectAttempts = attemptsSnapshot.documents
                        .filter { subjectPaperIds.contains(it.getString("paperId") ?: "") }
                    val cumWarnings = subjectAttempts.sumOf { it.getLong("warnings")?.toInt() ?: 0 }
                    val prefs = context.getSharedPreferences("exam_prefs", Context.MODE_PRIVATE)
                    if (prefs.getString("last_ack_violation", "") != violationAttemptId) {
                        activeWarningCount = cumWarnings
                        activeWarningThreshold = warningThreshold
                        activeWarningSubject = violationSubject
                        activeViolationIdState = violationAttemptId
                        showWarningDialog = true
                    }
                }
            }

            val visiblePaperDocs = papersSnapshot.documents.filter { doc ->
                val status = doc.getString("status") ?: "published"
                val isVisible = doc.getBoolean("isVisible") != false
                val isHidden = doc.getBoolean("isHidden") == true
                status == "published" && isVisible && !isHidden
            }

            val papersBySubject = visiblePaperDocs.groupBy { doc ->
                val subj = doc.getString("subject")
                if (subj.isNullOrEmpty()) doc.getString("title") ?: "Examination" else subj
            }

            val items = mutableListOf<ExamPaperItem>()
            papersBySubject.forEach { (subject, subjectPapers) ->
                val subjectPaperIds = subjectPapers.map { it.id }
                val subjectAttempts = attemptsSnapshot.documents.filter {
                    subjectPaperIds.contains(it.getString("paperId") ?: "")
                }
                val isBlocked = subjectAttempts.any { it.getString("status") == "blocked_pending_review" }
                val isMalpractice = subjectAttempts.any { it.getString("status") == "malpractice_failed" }
                // ANY submitted attempt means the student has completed this exam — lock it.
                val isSubmitted = subjectAttempts.any { it.getString("status") == "submitted" }
                val activeAttempt = subjectAttempts.firstOrNull { it.getString("status") == "started" }
                val violationAttempt = subjectAttempts.firstOrNull { it.getString("status") == "exited_on_violation" }

                var finalStatus = "unstarted"
                var targetPaper = subjectPapers.first().id

                when {
                    // Hard locks (highest priority)
                    isBlocked    -> finalStatus = "blocked"
                    isMalpractice -> finalStatus = "failed"

                    // Student already submitted one set → entire subject is done
                    isSubmitted  -> finalStatus = "submitted"

                    // Resume an in-progress attempt
                    activeAttempt != null -> {
                        finalStatus = "started"
                        targetPaper = activeAttempt.getString("paperId") ?: ""
                    }

                    // Exited on violation → assign a fresh unused set if available
                    violationAttempt != null -> {
                        val attemptedIds = subjectAttempts.map { it.getString("paperId") ?: "" }
                        val unusedPaper = subjectPapers.firstOrNull { !attemptedIds.contains(it.id) }
                        finalStatus = "unstarted"
                        targetPaper = unusedPaper?.id ?: (violationAttempt.getString("paperId") ?: "")
                    }

                    // Never attempted — assign first unused set
                    else -> {
                        val attemptedIds = subjectAttempts.map { it.getString("paperId") ?: "" }
                        val unusedPaper = subjectPapers.firstOrNull { !attemptedIds.contains(it.id) }
                        finalStatus = "unstarted"
                        targetPaper = unusedPaper?.id ?: subjectPapers.first().id
                    }
                }

                val firstPaper = subjectPapers.first()
                val duration = firstPaper.getLong("durationMinutes")?.toInt() ?: 180
                val qCount = firstPaper.getLong("questionCount")?.toInt() ?: 60
                val scheduleStart = firstPaper.getString("scheduleStart")
                val scheduleEnd = firstPaper.getString("scheduleEnd")
                val fmtStart = formatScheduleDateTime(scheduleStart)
                val fmtEnd   = formatScheduleDateTime(scheduleEnd)
                val scheduleFormatted = when {
                    fmtStart != null && fmtEnd != null -> "$fmtStart – $fmtEnd"
                    fmtStart != null -> fmtStart
                    else -> "Available Now"
                }

                val isExamStarted = subjectPapers.any { it.getBoolean("isStarted") == true }
                val examOtp = subjectPapers.firstOrNull { !it.getString("examOtp").isNullOrEmpty() }?.getString("examOtp") ?: ""

                // Refine status based on schedule time & teacher start state (only for unstarted exams)
                if (finalStatus == "unstarted") {
                    val now = java.time.Instant.now()
                    val startInstant = parseScheduleInstant(scheduleStart)
                    val endInstant   = parseScheduleInstant(scheduleEnd)
                    finalStatus = when {
                        startInstant != null && now.isBefore(startInstant) -> "upcoming"
                        endInstant != null && now.isAfter(endInstant) -> "expired"
                        !isExamStarted -> "waiting_teacher"
                        else -> "unstarted" // within window & teacher started session → ready for OTP entry
                    }
                }

                items.add(
                    ExamPaperItem(
                        id = subject,
                        title = subject,
                        subtitle = "Exam pool · ${subjectPapers.size} ${if (subjectPapers.size == 1) "set" else "sets"}",
                        durationMinutes = duration,
                        questionCount = qCount,
                        scheduleText = scheduleFormatted,
                        userStatus = finalStatus,
                        targetPaperId = targetPaper,
                        isStarted = isExamStarted,
                        examOtp = examOtp
                    )
                )
            }
            examsList = items
        } catch (e: Exception) {
            e.printStackTrace()
            examsList = emptyList()
        } finally {
            loading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "DIET Proctored Exam Portal",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                },
                actions = {
                    // Circular avatar → opens Profile & Settings
                    Box(
                        modifier = Modifier
                            .padding(end = 12.dp)
                            .size(36.dp)
                            .background(
                                color = MaterialTheme.colorScheme.primaryContainer,
                                shape = CircleShape
                            )
                            .clickable { showProfileModal = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (studentName.isNotBlank() && studentName != "Student") {
                                studentName.split(" ")
                                    .mapNotNull { it.firstOrNull()?.toString() }
                                    .take(2).joinToString("").uppercase()
                            } else "S",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
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
            } else {
                Column(modifier = Modifier.fillMaxSize()) {

                    // ── Sticky Student Profile Card ────────────────────────
                    ProfileCard(
                        name = studentName,
                        email = studentEmail,
                        prn = studentPrn,
                        course = studentCourse,
                        semester = studentSemester,
                        isDeviceAdminActive = isDeviceAdminActive,
                        adminComponent = adminComponent,
                        context = context
                    )

                    // ── Section Header ─────────────────────────────────────
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Assigned Examinations",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        IconButton(
                            onClick = { refreshTrigger++ },
                            modifier = Modifier.size(30.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Refresh",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    // ── Exam Cards or Empty State ──────────────────────────
                    if (examsList.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                                    modifier = Modifier.size(48.dp)
                                )
                                Text(
                                    "No active examinations",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    "Check back later or contact your teacher.",
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                                )
                            }
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            contentPadding = PaddingValues(
                                start = 16.dp,
                                end = 16.dp,
                                bottom = 24.dp
                            ),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(examsList) { exam ->
                                ExamCard(
                                    exam = exam,
                                    onStartExam = onStartExam,
                                    onRequestOtp = { examItem ->
                                        selectedExamForOtp = examItem
                                        otpInput = ""
                                        otpError = ""
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // ── 6-Digit Room OTP Verification Dialog ───────────────────────────────
    if (selectedExamForOtp != null) {
        val exam = selectedExamForOtp!!
        AlertDialog(
            onDismissRequest = {
                selectedExamForOtp = null
                otpInput = ""
                otpError = ""
            },
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Shield,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text("Enter 6-Digit Exam Key", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Please enter the 6-digit session OTP key disclosed by your teacher / exam room invigilator to unlock:",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    OutlinedTextField(
                        value = otpInput,
                        onValueChange = {
                            if (it.length <= 6 && it.all { char -> char.isDigit() }) {
                                otpInput = it
                                otpError = ""
                            }
                        },
                        placeholder = { Text("6-digit code (e.g. 582910)") },
                        singleLine = true,
                        isError = otpError.isNotEmpty(),
                        supportingText = if (otpError.isNotEmpty()) {
                            { Text(otpError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                        } else null,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val trimmedOtp = otpInput.trim()
                        val targetOtp = exam.examOtp.trim()
                        if (trimmedOtp.length != 6) {
                            otpError = "Please enter all 6 digits."
                        } else if (targetOtp.isNotEmpty() && trimmedOtp != targetOtp) {
                            otpError = "Invalid Exam OTP. Please check the code provided by your teacher."
                        } else {
                            val targetPaper = exam.targetPaperId
                            selectedExamForOtp = null
                            otpInput = ""
                            otpError = ""
                            onStartExam(targetPaper)
                        }
                    },
                    enabled = otpInput.length == 6
                ) {
                    Text("Verify & Start Exam")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    selectedExamForOtp = null
                    otpInput = ""
                    otpError = ""
                }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── Profile & Settings Modal ───────────────────────────────────────────
    if (showProfileModal) {
        ProfileSettingsDialog(
            studentName = studentName,
            studentEmail = studentEmail,
            studentPrn = studentPrn,
            studentCourse = studentCourse,
            studentSemester = studentSemester,
            currentTheme = currentTheme,
            context = context,
            onDismiss = { showProfileModal = false },
            onLogout = {
                showProfileModal = false
                onLogout()
            }
        )
    }

    // ── Violation Warning Dialog ───────────────────────────────────────────
    if (showWarningDialog) {
        AlertDialog(
            onDismissRequest = { /* force explicit dismiss */ },
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                    Text(
                        "Malpractice Warning",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "A focus-loss violation was detected during your attempt on: $activeWarningSubject.",
                        fontSize = 14.sp
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f),
                                RoundedCornerShape(8.dp)
                            )
                            .padding(16.dp)
                    ) {
                        Column {
                            Text(
                                "Warnings: $activeWarningCount of $activeWarningThreshold",
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                fontSize = 16.sp
                            )
                            Spacer(Modifier.height(4.dp))
                            val remaining = activeWarningThreshold - activeWarningCount
                            Text(
                                text = if (remaining > 0)
                                    "You have $remaining warning${if (remaining > 1) "s" else ""} remaining before your account is locked."
                                else
                                    "Your account is now blocked pending teacher review.",
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
                        context.getSharedPreferences("exam_prefs", Context.MODE_PRIVATE)
                            .edit().putString("last_ack_violation", activeViolationIdState).apply()
                        showWarningDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("I Understand")
                }
            }
        )
    }
}

// ─── Profile Card (Sticky Header) ─────────────────────────────────────────────

@Composable
private fun ProfileCard(
    name: String,
    email: String,
    prn: String,
    course: String,
    semester: String,
    isDeviceAdminActive: Boolean,
    adminComponent: ComponentName,
    context: Context
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {

            // Name + Protection badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                    Text(
                        text = name,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        lineHeight = 24.sp
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = email,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = if (isDeviceAdminActive)
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
                    else
                        MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.6f)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp)
                    ) {
                        Icon(
                            imageVector = if (isDeviceAdminActive) Icons.Default.Shield else Icons.Default.Warning,
                            contentDescription = null,
                            tint = if (isDeviceAdminActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(12.dp)
                        )
                        Text(
                            text = if (isDeviceAdminActive) "Protected" else "Action Needed",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isDeviceAdminActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            // PRN badge
            if (prn.isNotBlank() && prn != "N/A") {
                Spacer(Modifier.height(8.dp))
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
                ) {
                    Text(
                        text = "PRN: $prn",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
            Spacer(Modifier.height(10.dp))

            // Academic info grid
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                AcademicInfoCell(label = "BRANCH", value = course, modifier = Modifier.weight(1f))
                AcademicInfoCell(label = "SEMESTER", value = semester, modifier = Modifier.weight(1f))
            }

            // Device admin CTA
            if (!isDeviceAdminActive) {
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                            putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                            putExtra(
                                DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                                "Activate device admin to lock the exam app screen during proctored exams."
                            )
                        }
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    contentPadding = PaddingValues(vertical = 10.dp)
                ) {
                    Icon(Icons.Default.Shield, contentDescription = null, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Activate Device Admin", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun AcademicInfoCell(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f)
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = value,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

// ─── Exam Card ─────────────────────────────────────────────────────────────────

@Composable
private fun ExamCard(
    exam: ExamPaperItem,
    onStartExam: (String) -> Unit,
    onRequestOtp: (ExamPaperItem) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {

            // Title & subtitle
            Text(
                text = exam.title,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                lineHeight = 20.sp
            )
            Spacer(Modifier.height(3.dp))
            Text(
                text = exam.subtitle,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(12.dp))

            // Meta info chips row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Duration
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        Icons.Default.Schedule,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        "${exam.durationMinutes} min",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Medium
                    )
                }
                // Questions
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Article,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        "${exam.questionCount} Qs",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Medium
                    )
                }
                // Schedule
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.weight(2f)
                ) {
                    Icon(
                        Icons.Default.DateRange,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        exam.scheduleText,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.12f))
            Spacer(Modifier.height(12.dp))

            // Status badge + Action button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Status badge
                val (badgeText, badgeColor, badgeTextColor) = when (exam.userStatus) {
                    "submitted" -> Triple(
                        "✓ Submitted",
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
                        MaterialTheme.colorScheme.primary
                    )
                    "started" -> Triple(
                        "In Progress",
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                        MaterialTheme.colorScheme.primary
                    )
                    "blocked" -> Triple(
                        "🔒 Locked",
                        MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f),
                        MaterialTheme.colorScheme.error
                    )
                    "failed" -> Triple(
                        "Malpractice",
                        MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f),
                        MaterialTheme.colorScheme.error
                    )
                    "upcoming" -> Triple(
                        "Upcoming",
                        MaterialTheme.colorScheme.surfaceVariant,
                        MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    "expired" -> Triple(
                        "Expired",
                        MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.35f),
                        MaterialTheme.colorScheme.error.copy(alpha = 0.8f)
                    )
                    "waiting_teacher" -> Triple(
                        "Waiting for Teacher",
                        MaterialTheme.colorScheme.surfaceVariant,
                        MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    else -> Triple( // "unstarted" — session started by teacher
                        "🟢 Live in Room",
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
                        MaterialTheme.colorScheme.primary
                    )
                }
                Surface(shape = RoundedCornerShape(8.dp), color = badgeColor) {
                    Text(
                        text = badgeText,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = badgeTextColor,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
                    )
                }

                // Action button
                when (exam.userStatus) {
                    "submitted" -> Button(
                        onClick = {},
                        enabled = false,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                            disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        ),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 9.dp)
                    ) { Text("Submitted", fontSize = 13.sp, fontWeight = FontWeight.Bold) }

                    "started" -> Button(
                        onClick = { onStartExam(exam.targetPaperId) },
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 9.dp)
                    ) { Text("Resume", fontSize = 13.sp, fontWeight = FontWeight.Bold) }

                    "blocked" -> Button(
                        onClick = {},
                        enabled = false,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            disabledContainerColor = MaterialTheme.colorScheme.errorContainer,
                            disabledContentColor = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
                        ),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 9.dp)
                    ) { Text("Blocked", fontSize = 13.sp, fontWeight = FontWeight.Bold) }

                    "failed" -> Button(
                        onClick = {},
                        enabled = false,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            disabledContainerColor = MaterialTheme.colorScheme.errorContainer,
                            disabledContentColor = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
                        ),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 9.dp)
                    ) { Text("Malpractice", fontSize = 13.sp, fontWeight = FontWeight.Bold) }

                    "upcoming" -> Button(
                        onClick = {},
                        enabled = false,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                            disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        ),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 9.dp)
                    ) { Text("Not Yet Open", fontSize = 13.sp, fontWeight = FontWeight.Bold) }

                    "expired" -> Button(
                        onClick = {},
                        enabled = false,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            disabledContainerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f),
                            disabledContentColor = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
                        ),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 9.dp)
                    ) { Text("Expired", fontSize = 13.sp, fontWeight = FontWeight.Bold) }

                    "waiting_teacher" -> Button(
                        onClick = {},
                        enabled = false,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                            disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        ),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 9.dp)
                    ) { Text("Session Not Started", fontSize = 13.sp, fontWeight = FontWeight.Bold) }

                    else -> Button( // "unstarted" — started by teacher & within window
                        onClick = { onRequestOtp(exam) },
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        ),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 9.dp)
                    ) { Text("Start Exam", fontSize = 13.sp, fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

// ─── Profile & Settings Dialog ─────────────────────────────────────────────────

@Composable
private fun ProfileSettingsDialog(
    studentName: String,
    studentEmail: String,
    studentPrn: String,
    studentCourse: String,
    studentSemester: String,
    currentTheme: ThemeMode,
    context: Context,
    onDismiss: () -> Unit,
    onLogout: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Student Settings",
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Close",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Avatar + name/email/PRN
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .background(MaterialTheme.colorScheme.primaryContainer, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (studentName.isNotBlank() && studentName != "Student") {
                                studentName.split(" ")
                                    .mapNotNull { it.firstOrNull()?.toString() }
                                    .take(2).joinToString("").uppercase()
                            } else "S",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                    Column {
                        Text(
                            studentName,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            studentEmail,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (studentPrn.isNotBlank() && studentPrn != "N/A") {
                            Text(
                                "PRN: $studentPrn",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                // Theme selector
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "Appearance",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.4.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        FilterChip(
                            selected = currentTheme == ThemeMode.LIGHT,
                            onClick = { ThemeManager.setTheme(context, ThemeMode.LIGHT) },
                            label = { Text("Light", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.LightMode, null, modifier = Modifier.size(13.dp))
                            },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = currentTheme == ThemeMode.DARK,
                            onClick = { ThemeManager.setTheme(context, ThemeMode.DARK) },
                            label = { Text("Dark", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.DarkMode, null, modifier = Modifier.size(13.dp))
                            },
                            modifier = Modifier.weight(1f)
                        )
                        FilterChip(
                            selected = currentTheme == ThemeMode.SYSTEM,
                            onClick = { ThemeManager.setTheme(context, ThemeMode.SYSTEM) },
                            label = { Text("System", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.SettingsBrightness, null, modifier = Modifier.size(13.dp))
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                // Academic info
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            "Branch: $studentCourse",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            "Semester: $studentSemester",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            "Campus: DIET Exam System",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onLogout,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(6.dp))
                Text("Sign Out", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Done") }
        }
    )
}
