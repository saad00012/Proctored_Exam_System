package edu.dnyanshree.exam.ui.exam

import edu.dnyanshree.exam.data.network.ExamNetworkService
import android.app.Activity
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.tasks.await

// Device Admin & Telephony imports
import android.content.Context
import android.content.Intent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.os.PowerManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.telephony.TelephonyManager
import android.telephony.TelephonyCallback
import android.telephony.PhoneStateListener
import android.os.Build

// Gestures & HTTP networking libraries
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.Offset
import org.json.JSONObject
import androidx.compose.ui.window.Dialog
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableFloatStateOf

import edu.dnyanshree.exam.data.model.Question
import edu.dnyanshree.exam.data.model.Option
import edu.dnyanshree.exam.ui.exam.components.TimerBadge
import edu.dnyanshree.exam.ui.exam.components.ScorecardOverlay
import edu.dnyanshree.exam.ui.exam.components.MalpracticeAlertDialog

private val networkService = ExamNetworkService()

// Helper function for Express backend API calls (delegated to network module)
private suspend fun makeApiRequest(endpoint: String, method: String, jsonBody: String, authToken: String? = null): JSONObject {
    return networkService.makeApiRequest(endpoint, method, jsonBody, authToken)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExamScreen(
    paperId: String,
    onExamFinished: () -> Unit,
    onViolationSignOut: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Background scope to survive backgrounding on exit
    val backgroundScope = remember { CoroutineScope(Dispatchers.IO) }
    DisposableEffect(Unit) {
        onDispose {
            backgroundScope.cancel()
        }
    }

    // Firestore & Auth handles
    val firestore = remember { FirebaseFirestore.getInstance() }
    val currentUser = remember { FirebaseAuth.getInstance().currentUser }
    val studentId = currentUser?.uid ?: ""
    val studentNameState = remember { mutableStateOf(currentUser?.displayName ?: "Student") }
    var attemptId by remember(paperId) { mutableStateOf("${studentId}_${paperId}") }

    // Device Admin Configuration & Verification
    val devicePolicyManager = remember {
        context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    }
    val adminComponent = remember {
        ComponentName(context, edu.dnyanshree.exam.MyDeviceAdminReceiver::class.java)
    }
    var isDeviceAdminActive by remember {
        mutableStateOf(devicePolicyManager.isAdminActive(adminComponent))
    }

    val launcherAdmin = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        isDeviceAdminActive = devicePolicyManager.isAdminActive(adminComponent)
    }

    // Telephony Call State checking
    var isPhoneCallActive by remember { mutableStateOf(false) }

    // Dialog zoom overlay states
    var zoomedImageUrl by remember { mutableStateOf<String?>(null) }

    // Image background pre-cache bitmap map
    val bitmapCache = remember { mutableStateMapOf<String, Bitmap>() }

    // Exam State
    var questions by remember { mutableStateOf<List<Question>>(emptyList()) }
    var currentQuestionIdx by remember { mutableIntStateOf(0) }
    var selectedAnswers by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var paperTitle by remember { mutableStateOf("Loading Exam...") }
    var paperSubject by remember { mutableStateOf("") }
    
    var defaultDurationSeconds by remember { mutableIntStateOf(2700) }
    var warningThreshold by remember { mutableIntStateOf(3) }
    var activePaperId by remember(paperId) { mutableStateOf(paperId) }

    // Initial standard exam duration
    var timeLeftSeconds by remember { mutableIntStateOf(2700) }
    var isExamRunning by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf("") }
    var showScoreScreen by remember { mutableStateOf(false) }
    var serverScore by remember { mutableIntStateOf(0) }
    var serverTotal by remember { mutableIntStateOf(0) }

    var refreshTrigger by remember { mutableIntStateOf(0) }
    var showWarningDialog by remember { mutableStateOf(false) }
    var warningCountForDialog by remember { mutableIntStateOf(0) }

    val currentIsExamRunning by rememberUpdatedState(isExamRunning)

    // Phone Call state listener to whitelist pauses
    DisposableEffect(context) {
        val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val callback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                override fun onCallStateChanged(state: Int) {
                    isPhoneCallActive = (state != TelephonyManager.CALL_STATE_IDLE)
                }
            }
            try {
                telephonyManager.registerTelephonyCallback(context.mainExecutor, callback)
            } catch (_: SecurityException) {
                // READ_PHONE_STATE permission might be missing
            }
            onDispose {
                try {
                    telephonyManager.unregisterTelephonyCallback(callback)
                } catch (_: Exception) {}
            }
        } else {
            @Suppress("DEPRECATION")
            val listener = object : PhoneStateListener() {
                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    isPhoneCallActive = (state != TelephonyManager.CALL_STATE_IDLE)
                }
            }
            try {
                @Suppress("DEPRECATION")
                telephonyManager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
            } catch (_: SecurityException) {
                // permission missing
            }
            onDispose {
                try {
                    @Suppress("DEPRECATION")
                    telephonyManager.listen(listener, PhoneStateListener.LISTEN_NONE)
                } catch (_: Exception) {}
            }
        }
    }

    // Lock camera when the exam begins (requires Device Admin active)
    LaunchedEffect(isExamRunning, isDeviceAdminActive) {
        if (isExamRunning && isDeviceAdminActive) {
            try {
                devicePolicyManager.setCameraDisabled(adminComponent, true)
            } catch (_: SecurityException) {
                // permission missing
            }
        }
    }

    // Release camera when screen is disposed or exam finishes
    DisposableEffect(Unit) {
        onDispose {
            try {
                devicePolicyManager.setCameraDisabled(adminComponent, false)
            } catch (_: Exception) {
                // Ignore
            }
        }
    }

    // Native Screenshot Blocker
    DisposableEffect(Unit) {
        val activity = context as? Activity
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        onDispose {
            activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    // Native Focus Loss / App background tracker (Violation handler using backgroundScope calling server)
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_PAUSE && currentIsExamRunning) {
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                val isScreenOn = powerManager.isInteractive
                
                // Whitelist if screen is off OR if phone call is active
                val isPermittedPause = !isScreenOn || isPhoneCallActive
                
                if (!isPermittedPause && timeLeftSeconds > 5) {
                    isExamRunning = false // Stop countdown timer
                    
                    backgroundScope.launch {
                        try {
                            // Fetch fresh token inside coroutine scope FIRST before any signOut
                            val violationToken = currentUser?.getIdToken(true)?.await()?.token ?: ""
                            
                            val requestBody = JSONObject().apply {
                                put("paperId", activePaperId)
                                put("reason", "Student switched application (focus lost)")
                            }.toString()

                            // Report violation to backend server-side transaction (with retry)
                            var success = false
                            var retryCount = 0
                            while (!success && retryCount < 3) {
                                try {
                                    makeApiRequest("/report-violation", "POST", requestBody, violationToken)
                                    success = true
                                } catch (e: Exception) {
                                    retryCount++
                                    if (retryCount < 3) {
                                        delay(1000L)
                                    }
                                }
                            }

                            if (!success && currentUser != null) {
                                // Try fallback writing directly to Firestore
                                try {
                                    val doc = firestore.collection("exam_attempts").document(attemptId).get().await()
                                    if (doc.exists()) {
                                        val curWarnings = doc.getLong("warnings") ?: 0
                                        firestore.collection("exam_attempts").document(attemptId).update(
                                            mapOf(
                                                "status" to "exited_on_violation",
                                                "warnings" to curWarnings + 1
                                            )
                                        ).await()
                                    }
                                } catch (_: Exception) {}
                            }
                            
                                // Navigate to login screen (onViolationSignOut handles signOut + isAuthenticated reset)
                                withContext(Dispatchers.Main) {
                                    onViolationSignOut()
                                }
                        } catch (_: Exception) {
                            // Safe fallback exit — still send to login
                            withContext(Dispatchers.Main) {
                                onViolationSignOut()
                            }
                        }
                    }
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Intercept back presses
    BackHandler(enabled = isExamRunning) {
        // Blocks exit
    }

    // Native Base64 to Bitmap converter
    fun decodeBase64ToBitmap(base64Str: String?): Bitmap? {
        if (base64Str == null) return null
        return try {
            val cleanStr = if (base64Str.startsWith("data:image")) {
                base64Str.substringAfter(",")
            } else {
                base64Str
            }
            val decodedBytes = Base64.decode(cleanStr, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
        } catch (_: Exception) {
            null
        }
    }

    // Auto-save via Express Backend API
    fun autoSaveAnswer(questionId: String, optionIdx: Int) {
        val updatedAnswers = selectedAnswers.toMutableMap().apply {
            put(questionId, optionIdx)
        }
        selectedAnswers = updatedAnswers

        backgroundScope.launch {
            try {
                val token = currentUser?.getIdToken(true)?.await()?.token ?: ""

                val requestBody = JSONObject().apply {
                    put("paperId", activePaperId)
                    put("questionId", questionId)
                    put("selectedOptionIndex", optionIdx)
                }.toString()

                makeApiRequest("/submit-answer", "POST", requestBody, token)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Submit via Express Backend API
    fun submitExam() {
        if (!isExamRunning) return
        isExamRunning = false
        loading = true

        coroutineScope.launch {
            try {
                val token = currentUser?.getIdToken(true)?.await()?.token ?: ""

                val requestBody = JSONObject().apply {
                    put("paperId", activePaperId)
                }.toString()

                val response = makeApiRequest("/auto-submit", "POST", requestBody, token)
                serverScore = response.optInt("score", 0)
                serverTotal = response.optInt("total", 0)
                showScoreScreen = true
            } catch (_: Exception) {
                // Ignore
            } finally {
                loading = false
            }
        }
    }

    // Initial load utilizing start-exam server logic
    LaunchedEffect(paperId, refreshTrigger) {
        currentQuestionIdx = 0
        selectedAnswers = emptyMap()
        try {
            val token = if (currentUser != null) {
                try {
                    val userDoc = firestore.collection("users").document(studentId).get().await()
                    studentNameState.value = userDoc.getString("name") ?: currentUser.email?.substringBefore("@") ?: "Student"
                } catch (_: Exception) {
                    studentNameState.value = currentUser.email?.substringBefore("@") ?: "Student"
                }
                currentUser.getIdToken(true).await().token ?: ""
            } else {
                ""
            }

            // 1. Call server to start/check attempt (authoritative check)
            val startBody = JSONObject().apply {
                put("paperId", paperId)
            }.toString()

            val startResponse = makeApiRequest("/start-exam", "POST", startBody, token)
            val serverPaperId = startResponse.optString("paperId", paperId)
            activePaperId = serverPaperId
            attemptId = "${studentId}_${activePaperId}"

            val serverRemainingSeconds = startResponse.getInt("remainingTimeSeconds")
            val serverWarningsCount = startResponse.optInt("warningsCount", 0)

            if (serverWarningsCount > 0) {
                warningCountForDialog = serverWarningsCount
                showWarningDialog = true
            }

            val isMockMode = (currentUser == null)

            // 2. Parse paper details from server response
            val serverPaper = startResponse.optJSONObject("paper")
            if (serverPaper != null) {
                paperTitle = serverPaper.optString("title", "Exam Paper")
                paperSubject = serverPaper.optString("subject", "")
            } else {
                paperTitle = "Exam Paper"
                paperSubject = "N/A"
            }

            // Sync countdown timer with backend limit
            timeLeftSeconds = serverRemainingSeconds

            // Fetch warning threshold dynamically
            if (!isMockMode) {
                try {
                    val configDoc = firestore.collection("settings").document("config").get().await()
                    if (configDoc.exists()) {
                        warningThreshold = configDoc.getLong("warningThreshold")?.toInt() ?: 3
                    }
                } catch (_: Exception) {
                    // Ignore
                }
            } else {

                try {
                    val policiesResponse = makeApiRequest("/admin/policies", "GET", "")
                    warningThreshold = policiesResponse.optInt("warningThreshold", 3)
                } catch (_: Exception) {}
            }

            // Sync any existing answers
            if (!isMockMode) {
                try {
                    val attemptDoc = firestore.collection("exam_attempts").document(attemptId).get().await()
                    if (attemptDoc.exists()) {
                        @Suppress("UNCHECKED_CAST")
                        val savedAnswers = attemptDoc.get("answers") as? Map<String, Long> ?: emptyMap()
                        selectedAnswers = savedAnswers.mapValues { it.value.toInt() }
                    }
                } catch (_: Exception) {
                    // Ignore
                }
            }

            // 3. Parse questions directly from server response
            val qList = mutableListOf<Question>()
            val questionsArray = startResponse.optJSONArray("questions")
            if (questionsArray != null && questionsArray.length() > 0) {
                for (i in 0 until questionsArray.length()) {
                    val qObj = questionsArray.getJSONObject(i)
                    val id = qObj.getString("id")
                    val text = qObj.getString("questionText")
                    val imgUrl = qObj.optString("questionImageUrl").takeIf { it.isNotEmpty() && it != "null" }
                    val correctIndex = qObj.optInt("correctOptionIndex", -1)
                    val subject = qObj.optString("subject", paperSubject)
                    
                    val optionsArray = qObj.getJSONArray("options")
                    val parsedOptions = mutableListOf<Option>()
                    for (j in 0 until optionsArray.length()) {
                        val optObj = optionsArray.getJSONObject(j)
                        val optText = optObj.getString("text")
                        val optImg = optObj.optString("imageUrl").takeIf { it.isNotEmpty() && it != "null" }
                        parsedOptions.add(Option(optText, optImg))
                    }
                    qList.add(Question(id, text, imgUrl, parsedOptions, correctIndex, subject))
                }
            }

            // Fallback for offline if list is empty
            if (qList.isEmpty()) {
                when {
                    paperId.contains("ee") || paperId == "paper-1" -> {
                        qList.add(Question(
                            id = "q-ee-1",
                            questionText = "[ELECTRICAL SET A] Question 1: Which formula represents Ohm's Law?",
                            questionImageUrl = null,
                            options = listOf(Option("V = I * R", null), Option("P = V * I", null), Option("R = V * P", null), Option("I = V * R", null)),
                            correctOptionIndex = 0,
                            subject = "Electrical Engineering"
                        ))
                    }
                    paperId == "cse-set-b" || paperId == "paper-3" -> {
                        qList.add(Question(
                            id = "q-cse-b-1",
                            questionText = "[SET B] Question 1: Which data structure operates on a Last-In, First-Out (LIFO) order?",
                            questionImageUrl = null,
                            options = listOf(Option("Stack", null), Option("Queue", null), Option("Array", null), Option("Linked List", null)),
                            correctOptionIndex = 0,
                            subject = "Computer Science"
                        ))
                    }
                    paperId == "cse-set-c" -> {
                        qList.add(Question(
                            id = "q-cse-c-1",
                            questionText = "[SET C] Question 1: Which graph traversal algorithm uses a Queue data structure?",
                            questionImageUrl = null,
                            options = listOf(Option("Breadth-First Search (BFS)", null), Option("Depth-First Search (DFS)", null), Option("Dijkstra Algorithm", null), Option("Kruskal Algorithm", null)),
                            correctOptionIndex = 0,
                            subject = "Computer Science"
                        ))
                    }
                    else -> {
                        qList.add(Question(
                            id = "q-cse-a-1",
                            questionText = "[SET A] Question 1: What is the average time complexity of Binary Search in a sorted array?",
                            questionImageUrl = null,
                            options = listOf(Option("O(log n)", null), Option("O(n)", null), Option("O(n^2)", null), Option("Option 4", null)),
                            correctOptionIndex = 0,
                            subject = "Computer Science"
                        ))
                    }
                }
            }

            // 4. Pre-cache all images in the background to prevent timed-session lag
            withContext(Dispatchers.Default) {
                qList.forEach { q ->
                    q.questionImageUrl?.let { base64Str ->
                        val bmp = decodeBase64ToBitmap(base64Str)
                        if (bmp != null) bitmapCache[base64Str] = bmp
                    }
                    q.options.forEach { opt ->
                        opt.imageUrl?.let { base64Str ->
                            val bmp = decodeBase64ToBitmap(base64Str)
                            if (bmp != null) bitmapCache[base64Str] = bmp
                        }
                    }
                }
            }

            if (qList.isEmpty()) {
                errorMsg = "No questions found in this exam paper."
            } else {
                questions = qList
                isExamRunning = true
            }
        } catch (e: Exception) {
            errorMsg = e.message ?: "Failed to initialize exam."
        } finally {
            loading = false
        }
    }

    // Countdown Timer logic
    LaunchedEffect(isExamRunning) {
        if (isExamRunning) {
            while (timeLeftSeconds > 0 && isExamRunning) {
                delay(1000L)
                timeLeftSeconds -= 1
            }
            if (timeLeftSeconds == 0 && isExamRunning) {
                submitExam()
            }
        }
    }

    // Heartbeat checker loop: pings the server every 10 seconds to sync timer and check session status
    LaunchedEffect(isExamRunning) {
        if (isExamRunning) {
            while (isExamRunning) {
                delay(10000L) // Ping every 10 seconds
                if (!isExamRunning) break
                
                try {
                    val token = currentUser?.getIdToken(true)?.await()?.token ?: ""

                    val requestBody = JSONObject().apply {
                        put("paperId", activePaperId)
                    }.toString()

                    val response = makeApiRequest("/heartbeat", "POST", requestBody, token)
                    val status = response.getString("status")
                    
                    if (status == "submitted" || status == "blocked_pending_review" || status == "malpractice_failed" || status == "exited_on_violation") {
                        // Server terminated the exam — redirect to login
                        isExamRunning = false
                        withContext(Dispatchers.Main) {
                            if (status == "submitted") {
                                onExamFinished() // normal finish, stay logged in
                            } else {
                                onViolationSignOut() // violation/block — force re-login
                            }
                        }
                        break
                    }
                    
                    val serverRemaining = response.getInt("remainingTimeSeconds")
                    // M2 fix: Only sync if delta > 5s to prevent non-atomic timer jumps
                    if (Math.abs(serverRemaining - timeLeftSeconds) > 5) {
                        timeLeftSeconds = serverRemaining
                    }
                } catch (_: Exception) {
                    // Ignore
                }
            }
        }
    }

    // 1. Instant Score Display Screen after submission
    if (showScoreScreen) {
        val totalQuestions = if (serverTotal > 0) serverTotal else questions.size
        val score = if (serverTotal > 0) serverScore else questions.count { q -> selectedAnswers[q.id] == q.correctOptionIndex }
        val percentage = if (totalQuestions > 0) (score * 100) / totalQuestions else 0
        
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Card(
                modifier = Modifier.padding(24.dp),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Exam Score Report",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    
                    HorizontalDivider()
                    
                    Spacer(modifier = Modifier.height(8.dp))

                    // Premium Circular Progress Ring
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier.size(120.dp)
                    ) {
                        CircularProgressIndicator(
                            progress = { percentage / 100f },
                            modifier = Modifier.fillMaxSize(),
                            color = if (percentage >= 50) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                            strokeWidth = 10.dp,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "$percentage%",
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "accuracy",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Score", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("$score / $totalQuestions", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Result", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                text = if (percentage >= 50) "PASSED" else "FAILED",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (percentage >= 50) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Button(
                        onClick = onExamFinished,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Return to Lobby")
                    }
                }
            }
        }
        return
    }

    // Hard Gate: Block exam if Device Admin is not active
    if (!isDeviceAdminActive) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Card(
                modifier = Modifier.padding(24.dp),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Device Admin Required",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = "To ensure a secure exam environment, this application disables the camera for the duration of the test. You must activate Device Admin privileges to start.",
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Button(
                        onClick = {
                            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                                putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Enforce security and block camera access during active exam sessions.")
                            }
                            launcherAdmin.launch(intent)
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Activate Device Admin")
                    }
                }
            }
        }
        return
    }

    if (loading) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(12.dp))
                Text("Initializing live proctored exam...", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        return
    }

    if (errorMsg.isNotEmpty()) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(24.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = "Warning",
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(errorMsg, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(24.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Button(
                        onClick = {
                            loading = true
                            errorMsg = ""
                            refreshTrigger++
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Refresh Status")
                    }
                    OutlinedButton(
                        onClick = onExamFinished,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Exit to Lobby")
                    }
                }
            }
        }
        return
    }

    if (showWarningDialog) {
        AlertDialog(
            onDismissRequest = { showWarningDialog = false },
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = "Warning",
                        tint = MaterialTheme.colorScheme.error
                    )
                    Text("Proctor Warning")
                }
            },
            text = {
                Text(
                    text = "You have committed a focus-loss/app-switching violation. A new paper has been assigned, and your time has been reduced accordingly.\n\n" +
                           "Warnings: $warningCountForDialog of 3. Reaching 3 warnings will result in a hard block."
                )
            },
            confirmButton = {
                Button(onClick = { showWarningDialog = false }) {
                    Text("Acknowledge & Continue")
                }
            }
        )
    }

    val currentQuestion = questions.getOrNull(currentQuestionIdx)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(paperTitle, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text(paperSubject, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                actions = {
                    val minutes = timeLeftSeconds / 60
                    val seconds = timeLeftSeconds % 60
                    val isRunningOut = timeLeftSeconds < 300 // 5 minutes
                    
                    Box(
                        modifier = Modifier
                            .padding(end = 12.dp)
                            .background(
                                color = if (isRunningOut) {
                                    MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.2f)
                                } else {
                                    MaterialTheme.colorScheme.surfaceVariant
                                },
                                shape = RoundedCornerShape(12.dp)
                            )
                            .border(
                                width = 1.dp,
                                color = if (isRunningOut) {
                                    MaterialTheme.colorScheme.error.copy(alpha = 0.5f)
                                } else {
                                    MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)
                                },
                                shape = RoundedCornerShape(12.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            if (isRunningOut) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                            Text(
                                text = String.format(java.util.Locale.US, "%02d:%02d", minutes, seconds),
                                color = if (isRunningOut) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 14.sp
                            )
                        }
                    }
                    
                    Button(
                        onClick = { submitExam() },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Text("Submit", fontSize = 13.sp)
                    }
                }
            )
        },
        bottomBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(16.dp)
            ) {
                Text(
                    text = "Question Navigator (Read-Only Grid)",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                LazyVerticalGrid(
                    columns = GridCells.Fixed(5),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 120.dp)
                ) {
                    items(questions.size) { idx ->
                        val qId = questions[idx].id
                        val isAnswered = selectedAnswers.containsKey(qId)
                        val isCurrent = currentQuestionIdx == idx
                        
                        val bgColor = when {
                            isCurrent -> MaterialTheme.colorScheme.primary
                            isAnswered -> Color(0xFF10B981)
                            else -> MaterialTheme.colorScheme.surface
                        }
                        
                        val textColor = when {
                            isCurrent -> MaterialTheme.colorScheme.onPrimary
                            isAnswered -> Color.White
                            else -> MaterialTheme.colorScheme.onSurface
                        }

                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .aspectRatio(1f)
                                .clip(CircleShape)
                                .background(bgColor)
                                .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                        ) {
                            Text(
                                text = "${idx + 1}",
                                color = textColor,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (currentQuestion != null) {
                    val answeredCount = selectedAnswers.size
                    val progressFraction = if (questions.isNotEmpty()) answeredCount.toFloat() / questions.size else 0f

                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Question ${currentQuestionIdx + 1} of ${questions.size}",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "$answeredCount / ${questions.size} Answered",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        
                        LinearProgressIndicator(
                            progress = { progressFraction },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = MaterialTheme.colorScheme.primary,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    }

                    // Question Card (Tap diagram to zoom)
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = currentQuestion.questionText,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                lineHeight = 22.sp
                            )

                            currentQuestion.questionImageUrl?.let { base64Str ->
                                val bitmap = bitmapCache[base64Str] ?: remember(base64Str) { decodeBase64ToBitmap(base64Str) }
                                bitmap?.let {
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Image(
                                        bitmap = it.asImageBitmap(),
                                        contentDescription = "Question Circuit Diagram",
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .heightIn(max = 180.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
                                            .clickable { zoomedImageUrl = base64Str }
                                    )
                                    Text(
                                        text = "🔍 Tap diagram to zoom",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Options List
                    val currentSelectedOpt = selectedAnswers[currentQuestion.id]
                    Column(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        currentQuestion.options.forEachIndexed { optIdx, option ->
                            val isSelected = currentSelectedOpt == optIdx
                            
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { autoSaveAnswer(currentQuestion.id, optIdx) },
                                colors = CardDefaults.cardColors(
                                    containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface
                                ),
                                border = BorderStroke(
                                    1.dp, 
                                    if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
                                ),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(22.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (isSelected) MaterialTheme.colorScheme.primary 
                                                else MaterialTheme.colorScheme.surfaceVariant
                                            )
                                            .border(
                                                width = 1.5.dp, 
                                                color = if (isSelected) MaterialTheme.colorScheme.primary 
                                                        else MaterialTheme.colorScheme.outline,
                                                shape = CircleShape
                                            ),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        if (isSelected) {
                                            Icon(
                                                imageVector = Icons.Default.Check,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.onPrimary,
                                                modifier = Modifier.size(14.dp)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    
                                    Column {
                                        Text(
                                            text = "${(65 + optIdx).toChar()}.  ${option.text}",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Normal
                                        )
                                        
                                        option.imageUrl?.let { base64Str ->
                                            val optBitmap = bitmapCache[base64Str] ?: remember(base64Str) { decodeBase64ToBitmap(base64Str) }
                                            optBitmap?.let {
                                                Spacer(modifier = Modifier.height(8.dp))
                                                Image(
                                                    bitmap = it.asImageBitmap(),
                                                    contentDescription = "Option diagram",
                                                    modifier = Modifier
                                                        .heightIn(max = 60.dp)
                                                        .clip(RoundedCornerShape(4.dp))
                                                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(4.dp))
                                                        .clickable { zoomedImageUrl = base64Str }
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Navigation Buttons Row (Forward-only progress: Skip allowed, Back forbidden)
                    val isCurrentAnswered = selectedAnswers.containsKey(currentQuestion.id)
                    val isLastQuestion = currentQuestionIdx >= questions.size - 1

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (!isLastQuestion) {
                            if (isCurrentAnswered) {
                                Button(
                                    onClick = { currentQuestionIdx += 1 },
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Next Question →", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                            } else {
                                OutlinedButton(
                                    onClick = { currentQuestionIdx += 1 },
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Skip & Next →", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                }
                            }
                        } else {
                            Button(
                                onClick = { submitExam() },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Finish & Submit Exam ✓", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    // Zoomable Full-Screen Image Dialog Overlay
    if (zoomedImageUrl != null) {
        Dialog(onDismissRequest = { zoomedImageUrl = null }) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(450.dp)
                    .padding(8.dp),
                shape = RoundedCornerShape(16.dp),
                color = Color.Black.copy(alpha = 0.95f)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    var scale by remember { mutableFloatStateOf(1f) }
                    var offset by remember { mutableStateOf(Offset.Zero) }
                    val bitmap = remember(zoomedImageUrl) { decodeBase64ToBitmap(zoomedImageUrl) }
                    
                    bitmap?.let {
                        Image(
                            bitmap = it.asImageBitmap(),
                            contentDescription = "Zoomable Diagram",
                            modifier = Modifier
                                .fillMaxWidth()
                                .pointerInput(Unit) {
                                    detectTransformGestures { _, pan, zoom, _ ->
                                        scale = (scale * zoom).coerceIn(1f, 5f)
                                        offset = if (scale == 1f) Offset.Zero else offset + pan
                                    }
                                }
                                .graphicsLayer(
                                    scaleX = scale,
                                    scaleY = scale,
                                    translationX = offset.x,
                                    translationY = offset.y
                                )
                        )
                    }

                    // Close indicator/button
                    Button(
                        onClick = { zoomedImageUrl = null },
                        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text("Close View")
                    }
                }
            }
        }
    }
}


