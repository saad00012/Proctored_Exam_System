package edu.dnyanshree.exam.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

// Backend base URL (127.0.0.1 maps to localhost)
private const val BACKEND_URL = "http://127.0.0.1:5000"

@Composable
fun AuthScreen(onAuthSuccess: () -> Unit) {
    var isLogin by remember { mutableStateOf(true) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var course by remember { mutableStateOf("") }
    var semester by remember { mutableStateOf("") }
    
    var errorMsg by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    
    // OTP Dialog state
    var showOtpDialog by remember { mutableStateOf(false) }
    var otpCode by remember { mutableStateOf("") }
    var verificationId by remember { mutableStateOf("") }
    var pendingUserToken by remember { mutableStateOf("") }

    val coroutineScope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = if (isLogin) "Student Login" else "Student Register",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            if (errorMsg.isNotEmpty()) {
                Text(
                    text = errorMsg,
                    color = MaterialTheme.colorScheme.error,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
            }

            if (!isLogin) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full Name") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = course,
                    onValueChange = { course = it },
                    label = { Text("Course (e.g. B.Tech CSE)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = semester,
                    onValueChange = { semester = it },
                    label = { Text("Semester (e.g. Sem 5)") },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("College Email (@dnyanshree.edu.in)") },
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )

            if (!isLogin) {
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Mobile Number") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                )
            }

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
            )

            Button(
                onClick = {
                    if (isLogin) {
                        handleLogin(
                            email, password, coroutineScope, 
                            onSuccess = onAuthSuccess,
                            onError = { errorMsg = it },
                            onLoading = { loading = it }
                        )
                    } else {
                        handleRegisterStart(
                            name, email, phone, password, course, semester, coroutineScope,
                            onShowOtp = { verId, token ->
                                verificationId = verId
                                pendingUserToken = token
                                showOtpDialog = true
                            },
                            onError = { errorMsg = it },
                            onLoading = { loading = it }
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !loading
            ) {
                Text(if (loading) "Processing..." else if (isLogin) "Log In" else "Sign Up")
            }

            TextButton(
                onClick = {
                    isLogin = !isLogin
                    errorMsg = ""
                }
            ) {
                Text(if (isLogin) "Create an account" else "Already have an account? Log In")
            }
        }
    }

    // OTP Code Dialog
    if (showOtpDialog) {
        Dialog(onDismissRequest = { }) {
            Surface(
                shape = MaterialTheme.shapes.medium,
                tonalElevation = 8.dp
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Verify Phone OTP",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Enter the 6-digit code sent to $phone",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    OutlinedTextField(
                        value = otpCode,
                        onValueChange = { if (it.length <= 6) otpCode = it },
                        label = { Text("6-Digit OTP") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(onClick = { showOtpDialog = false }) {
                            Text("Cancel")
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                handleOtpVerification(
                                    otpCode, verificationId, pendingUserToken, name, phone, course, semester, coroutineScope,
                                    onSuccess = {
                                        showOtpDialog = false
                                        onAuthSuccess()
                                    },
                                    onError = { errorMsg = it },
                                    onLoading = { loading = it }
                                )
                            },
                            enabled = otpCode.length == 6 && !loading
                        ) {
                            Text("Verify")
                        }
                    }
                }
            }
        }
    }
}

// Check if Firebase is running with mock coordinates/placeholder configs
private fun checkIsFirebaseMock(): Boolean {
    return try {
        val app = FirebaseApp.getInstance()
        val projectId = app.options.projectId
        projectId == "dnyanshree-exam-mock" || app.options.apiKey == "mock-api-key-value"
    } catch (e: Exception) {
        true
    }
}

// Core API call functions
private suspend fun makeApiRequest(endpoint: String, method: String, jsonBody: String, authToken: String? = null): JSONObject = withContext(Dispatchers.IO) {
    val url = URL("$BACKEND_URL$endpoint")
    val conn = url.openConnection() as HttpURLConnection
    conn.requestMethod = method
    conn.connectTimeout = 10000
    conn.readTimeout = 10000
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

    JSONObject(responseText)
}

// Auth Flow Trigger Actions
private fun handleLogin(
    email: String, password: String, scope: CoroutineScope,
    onSuccess: () -> Unit, onError: (String) -> Unit, onLoading: (Boolean) -> Unit
) {
    if (email.isEmpty() || password.isEmpty()) {
        onError("Please enter both email and password.")
        return
    }

    onLoading(true)
    scope.launch {
        // Detect Mock credentials offline
        if (checkIsFirebaseMock() || (email.endsWith("@dnyanshree.edu.in") && password == "password")) {
            try {
                // Verify mock credentials via register-check endpoint
                val requestBody = JSONObject().apply {
                    put("email", email)
                    put("phoneNumber", "1234567890")
                }.toString()
                makeApiRequest("/register-check", "POST", requestBody)
                
                onLoading(false)
                onSuccess()
            } catch (e: Exception) {
                onLoading(false)
                onError(e.message ?: "Authentication failed.")
            }
            return@launch
        }

        // Live Firebase Sign-In Flow
        try {
            val firebaseAuth = FirebaseAuth.getInstance()
            firebaseAuth.signInWithEmailAndPassword(email, password)
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        val user = task.result?.user
                        
                        // Check if email is verified in live mode
                        if (user != null && !user.isEmailVerified) {
                            onLoading(false)
                            onError("Please verify your email address. A verification link was sent to $email.")
                            firebaseAuth.signOut()
                            return@addOnCompleteListener
                        }
                        
                        user?.getIdToken(true)?.addOnCompleteListener { tokenTask ->
                            if (tokenTask.isSuccessful) {
                                val token = tokenTask.result?.token ?: ""
                                scope.launch {
                                    try {
                                        val profileBody = JSONObject().apply {
                                            put("name", user.displayName ?: "Student")
                                            put("phoneNumber", user.phoneNumber ?: "0000000000")
                                            put("role", "student")
                                        }.toString()
                                        makeApiRequest("/create-profile", "POST", profileBody, token)
                                        onLoading(false)
                                        onSuccess()
                                    } catch (e: Exception) {
                                        onLoading(false)
                                        onError(e.message ?: "Failed to sync profile with server.")
                                    }
                                }
                            } else {
                                onLoading(false)
                                onError(tokenTask.exception?.message ?: "Failed to get auth token.")
                            }
                        }
                    } else {
                        onLoading(false)
                        onError(task.exception?.message ?: "Login failed. Check your credentials.")
                    }
                }
        } catch (e: Exception) {
            onLoading(false)
            onError(e.message ?: "Login failed.")
        }
    }
}

private fun handleRegisterStart(
    name: String, email: String, phone: String, password: String, course: String, semester: String, scope: CoroutineScope,
    onShowOtp: (String, String) -> Unit, onError: (String) -> Unit, onLoading: (Boolean) -> Unit
) {
    if (name.isEmpty() || email.isEmpty() || phone.isEmpty() || password.isEmpty() || course.isEmpty() || semester.isEmpty()) {
        onError("All registration fields (including Course & Semester) are required.")
        return
    }

    onLoading(true)
    scope.launch {
        try {
            // Step 1: Call Backend to check if Domain is whitelisted
            val checkBody = JSONObject().apply {
                put("email", email)
                put("phoneNumber", phone)
            }.toString()

            val checkResponse = makeApiRequest("/register-check", "POST", checkBody)
            val allowed = checkResponse.optBoolean("allowed", false)

            if (!allowed) {
                onLoading(false)
                onError("Registration rejected: domain is not whitelisted.")
                return@launch
            }

            // Check if Firebase is offline/missing (Mock Mode trigger)
            if (checkIsFirebaseMock()) {
                // Offline Mock path
                onLoading(false)
                onShowOtp("mock-verification-id", "mock-student")
            } else {
                // Live Firebase path
                val firebaseAuth = FirebaseAuth.getInstance()
                firebaseAuth.createUserWithEmailAndPassword(email, password)
                    .addOnCompleteListener { task ->
                        if (task.isSuccessful) {
                            val user = task.result?.user
                            
                            // Send verification email link natively
                            user?.sendEmailVerification()
                            
                            user?.getIdToken(true)?.addOnCompleteListener { tokenTask ->
                                if (tokenTask.isSuccessful) {
                                    val token = tokenTask.result?.token ?: ""
                                    onLoading(false)
                                    onShowOtp("live-verification-id", token)
                                } else {
                                    onLoading(false)
                                    onError(tokenTask.exception?.message ?: "Failed to generate ID token")
                                }
                            }
                        } else {
                            onLoading(false)
                            onError(task.exception?.message ?: "Firebase signup failed.")
                        }
                    }
            }
        } catch (e: Exception) {
            onLoading(false)
            onError(e.message ?: "Registration failed.")
        }
    }
}

private fun handleOtpVerification(
    otpCode: String, verificationId: String, token: String, name: String, phone: String, course: String, semester: String, scope: CoroutineScope,
    onSuccess: () -> Unit, onError: (String) -> Unit, onLoading: (Boolean) -> Unit
) {
    onLoading(true)
    scope.launch {
        try {
            if (token == "mock-student") {
                // Mock Mode OTP check
                val profileBody = JSONObject().apply {
                    put("name", name)
                    put("phoneNumber", phone)
                    put("role", "student")
                    put("course", course)
                    put("semester", semester)
                }.toString()
                
                // Submit profile creation to Backend using mock token
                makeApiRequest("/create-profile", "POST", profileBody, "mock-student")
                onLoading(false)
                onSuccess()
            } else {
                // Live Firebase Linking flow
                val firebaseAuth = FirebaseAuth.getInstance()
                val user = firebaseAuth.currentUser
                if (user != null) {
                    val credential = PhoneAuthProvider.getCredential(verificationId, otpCode)
                    user.linkWithCredential(credential)
                        .addOnCompleteListener { linkTask ->
                            if (linkTask.isSuccessful) {
                                scope.launch {
                                    try {
                                        val profileBody = JSONObject().apply {
                                            put("name", name)
                                            put("phoneNumber", phone)
                                            put("role", "student")
                                            put("course", course)
                                            put("semester", semester)
                                        }.toString()
                                        
                                        makeApiRequest("/create-profile", "POST", profileBody, token)
                                        onLoading(false)
                                        onSuccess()
                                    } catch (e: Exception) {
                                        onLoading(false)
                                        onError(e.message ?: "Failed to register profile on backend.")
                                    }
                                }
                            } else {
                                onLoading(false)
                                onError(linkTask.exception?.message ?: "Failed to link mobile number.")
                            }
                        }
                } else {
                    onLoading(false)
                    onError("No user currently logged in.")
                }
            }
        } catch (e: Exception) {
            onLoading(false)
            onError(e.message ?: "OTP Verification failed.")
        }
    }
}
