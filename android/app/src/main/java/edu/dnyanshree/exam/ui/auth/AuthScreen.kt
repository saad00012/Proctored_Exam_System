package edu.dnyanshree.exam.ui.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ArrowDropUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import edu.dnyanshree.exam.BuildConfig
import edu.dnyanshree.exam.data.network.ExamNetworkService
import edu.dnyanshree.exam.theme.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

private val PrimaryGradient = Brush.linearGradient(listOf(Indigo500, Violet500))
private val BackgroundGradient = Brush.verticalGradient(listOf(SurfaceLight, Color(0xFFF0F0FF)))

@Composable
fun AuthScreen(onAuthSuccess: () -> Unit) {
    var isLogin by remember { mutableStateOf(true) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var prn by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var department by remember { mutableStateOf("AI & DS Engineering") }
    
    val departments = listOf(
        "AI & DS Engineering",
        "Computer Science & Engineering",
        "Electrical & Computer Engineering",
        "Electronics & Telecommunication Engineering",
        "Mechanical & Mechatronics Engineering",
        "Applied Science & Engineering"
    )
    
    val semesters = if (department == "Applied Science & Engineering") {
        listOf("Semester 1", "Semester 2")
    } else {
        listOf("Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8")
    }
    
    var semester by remember { mutableStateOf(semesters.first()) }
    
    // Ensure semester is valid if department changes
    LaunchedEffect(department) {
        if (!semesters.contains(semester)) {
            semester = semesters.first()
        }
    }

    var errorMsg by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }



    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // === App Branding ===
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .shadow(elevation = 12.dp, shape = RoundedCornerShape(20.dp), ambientColor = Indigo500.copy(alpha = 0.3f))
                    .clip(RoundedCornerShape(20.dp))
                    .background(PrimaryGradient),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = "Secure Exam",
                    tint = White,
                    modifier = Modifier.size(34.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "SecureExam",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground,
                letterSpacing = (-0.5).sp
            )
            Text(
                text = "Dnyanshree Institute of Technology",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(28.dp))

            // === Main Card ===
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(24.dp)) {

                    // === Tab Toggle ===
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Gray100)
                            .padding(4.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            listOf(true to "Sign In", false to "Register").forEach { (tabIsLogin, label) ->
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(9.dp))
                                        .background(if (isLogin == tabIsLogin) White else Color.Transparent)
                                        .clickable { isLogin = tabIsLogin; errorMsg = "" }
                                        .padding(vertical = 10.dp)
                                        .then(
                                            if (isLogin == tabIsLogin)
                                                Modifier.shadow(2.dp, RoundedCornerShape(9.dp))
                                            else Modifier
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = label,
                                        fontWeight = if (isLogin == tabIsLogin) FontWeight.SemiBold else FontWeight.Normal,
                                        color = if (isLogin == tabIsLogin) Indigo500 else Gray400,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // === Error Message ===
                    AnimatedVisibility(
                        visible = errorMsg.isNotEmpty(),
                        enter = fadeIn() + slideInVertically(),
                        exit = fadeOut()
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Danger100)
                                .border(1.dp, Danger500.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                .padding(12.dp)
                        ) {
                            Text(
                                text = errorMsg,
                                color = Danger800,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                lineHeight = 18.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                    // === Register Fields ===
                    AnimatedVisibility(visible = !isLogin) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            StyledTextField(
                                value = name,
                                onValueChange = { name = it },
                                label = "Full Name",
                                icon = Icons.Default.Person,
                                keyboardType = KeyboardType.Text
                            )
                            StyledTextField(
                                value = prn,
                                onValueChange = { prn = it.uppercase() },
                                label = "PRN Number / Roll No.",
                                placeholder = "e.g. 210101001",
                                icon = Icons.Default.Person,
                                keyboardType = KeyboardType.Text
                            )
                            StyledDropdownField(
                                value = department,
                                onValueChange = { department = it },
                                options = departments,
                                label = "Department",
                                icon = Icons.Default.School
                            )
                            StyledDropdownField(
                                value = semester,
                                onValueChange = { semester = it },
                                options = semesters,
                                label = "Semester",
                                icon = Icons.Default.School
                            )
                            StyledTextField(
                                value = phone,
                                onValueChange = { phone = it },
                                label = "Mobile Number",
                                icon = Icons.Default.Phone,
                                keyboardType = KeyboardType.Phone
                            )
                        }
                    }

                    if (!isLogin) Spacer(modifier = Modifier.height(12.dp))

                    // === Common Fields ===
                    StyledTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = "College Email",
                        placeholder = "@dnyanshree.edu.in",
                        icon = Icons.Default.Email,
                        keyboardType = KeyboardType.Email
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    StyledTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = "Password",
                        icon = Icons.Default.Lock,
                        keyboardType = KeyboardType.Password,
                        isPassword = true
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // === Primary Action Button ===
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (!loading) PrimaryGradient else Brush.linearGradient(listOf(Gray300, Gray300)))
                            .clickable(enabled = !loading) {
                                if (isLogin) {
                                    handleLogin(email, password, coroutineScope,
                                        onSuccess = onAuthSuccess,
                                        onError = { errorMsg = it },
                                        onLoading = { loading = it })
                                } else {
                                    handleRegisterStart(name, prn, email, phone, password, department, semester, coroutineScope,
                                        onSuccess = {
                                            errorMsg = "Registration successful! Please check your email for a verification link."
                                            isLogin = true
                                        },
                                        onError = { errorMsg = it },
                                        onLoading = { loading = it })
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        if (loading) {
                            CircularProgressIndicator(color = White, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                        } else {
                            Text(
                                text = if (isLogin) "Sign In" else "Create Account",
                                color = White,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // === Footer note ===
            Text(
                text = "Use your college-issued email address to access the exam portal.",
                fontSize = 12.sp,
                color = Gray400,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )
        }
    }


}

@Composable
private fun StyledTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    icon: ImageVector? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, fontSize = 13.sp) },
        placeholder = if (placeholder.isNotEmpty()) ({ Text(placeholder, color = Gray400, fontSize = 13.sp) }) else null,
        leadingIcon = if (icon != null) ({
            Icon(imageVector = icon, contentDescription = null, tint = Gray400, modifier = Modifier.size(18.dp))
        }) else null,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        singleLine = true,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Indigo500,
            unfocusedBorderColor = Gray200,
            focusedLabelColor = Indigo500,
            unfocusedLabelColor = Gray400,
            cursorColor = Indigo500,
            focusedContainerColor = White,
            unfocusedContainerColor = Gray50,
        )
    )
}

// ===================================================================
// Private Business Logic Functions (unchanged from original)
// ===================================================================

private val networkService = ExamNetworkService()

// Core API call functions delegated to ExamNetworkService
private suspend fun makeApiRequest(endpoint: String, method: String, jsonBody: String, authToken: String? = null): JSONObject {
    return networkService.makeApiRequest(endpoint, method, jsonBody, authToken)
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
                                    onLoading(false)
                                    onSuccess()
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
    name: String, prn: String, email: String, phone: String, password: String, department: String, semester: String, scope: CoroutineScope,
    onSuccess: () -> Unit, onError: (String) -> Unit, onLoading: (Boolean) -> Unit
) {
    if (name.isBlank() || prn.isBlank() || email.isBlank() || phone.isBlank() || password.isBlank() || department.isBlank() || semester.isBlank()) {
        onError("All registration fields (including PRN, Department & Semester) are required.")
        return
    }

    onLoading(true)
    scope.launch {
        try {
            // Step 1: Call Backend to check if Domain is whitelisted (with local fallback if backend offline)
            var allowed = true
            try {
                val checkBody = JSONObject().apply {
                    put("email", email)
                    put("phoneNumber", phone)
                }.toString()

                val checkResponse = makeApiRequest("/register-check", "POST", checkBody)
                allowed = checkResponse.optBoolean("allowed", true)
            } catch (e: Exception) {
                // If backend check is unreachable, allow valid domain pattern check locally
                val domain = email.substringAfter("@", "")
                allowed = domain.isNotEmpty()
            }

            if (!allowed) {
                onLoading(false)
                onError("Registration rejected: domain is not whitelisted.")
                return@launch
            }

            // Step 2: Create user in Firebase Auth
            val firebaseAuth = FirebaseAuth.getInstance()
            firebaseAuth.createUserWithEmailAndPassword(email, password)
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        val user = task.result?.user

                        // Set Firebase Auth Display Name
                        user?.updateProfile(
                            UserProfileChangeRequest.Builder()
                                .setDisplayName(name)
                                .build()
                        )

                        // Directly write full profile to Firestore
                        val firestore = FirebaseFirestore.getInstance()
                        val cleanPrn = prn.trim().uppercase()
                        val profileMap = hashMapOf(
                            "uid" to (user?.uid ?: ""),
                            "name" to name,
                            "email" to email,
                            "phoneNumber" to phone,
                            "role" to "student",
                            "department" to department,
                            "semester" to semester,
                            "prnNumber" to cleanPrn,
                            "collegeDomain" to email.substringAfter("@"),
                            "createdAt" to FieldValue.serverTimestamp()
                        )
                        user?.uid?.let { uid ->
                            firestore.collection("users").document(uid).set(profileMap)
                        }

                        // Send verification email link natively
                        user?.sendEmailVerification()

                        // Step 3: Sync profile with backend
                        user?.getIdToken(true)?.addOnCompleteListener { tokenTask ->
                            val token = tokenTask.result?.token ?: ""
                            scope.launch {
                                try {
                                    val profileBody = JSONObject().apply {
                                        put("name", name)
                                        put("phoneNumber", phone)
                                        put("role", "student")
                                        put("department", department)
                                        put("semester", semester)
                                        put("prnNumber", cleanPrn)
                                    }.toString()

                                    if (token.isNotEmpty()) {
                                        makeApiRequest("/create-profile", "POST", profileBody, token)
                                    }
                                } catch (e: Exception) {
                                    // Non-blocking: Firestore direct write already succeeded
                                    e.printStackTrace()
                                } finally {
                                    onLoading(false)
                                    onSuccess()
                                }
                            }
                        }
                    } else {
                        onLoading(false)
                        onError(task.exception?.message ?: "Firebase signup failed.")
                    }
                }
        } catch (e: Exception) {
            onLoading(false)
            onError(e.message ?: "Registration failed.")
        }
    }
}

@Composable
fun StyledDropdownField(
    value: String,
    onValueChange: (String) -> Unit,
    options: List<String>,
    label: String,
    icon: ImageVector
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant) },
            leadingIcon = {
                Icon(imageVector = icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            },
            trailingIcon = {
                Icon(
                    imageVector = if (expanded) Icons.Default.ArrowDropUp else Icons.Default.ArrowDropDown,
                    contentDescription = null
                )
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = false,
            colors = OutlinedTextFieldDefaults.colors(
                disabledTextColor = MaterialTheme.colorScheme.onSurface,
                disabledBorderColor = MaterialTheme.colorScheme.outline,
                disabledLeadingIconColor = MaterialTheme.colorScheme.primary,
                disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant
            ),
            shape = RoundedCornerShape(12.dp)
        )
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(Color.Transparent)
                .clickable { expanded = true }
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.fillMaxWidth(0.8f)
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onValueChange(option)
                        expanded = false
                    }
                )
            }
        }
    }
}
