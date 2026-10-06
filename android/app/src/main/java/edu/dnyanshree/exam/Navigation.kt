package edu.dnyanshree.exam

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.google.firebase.firestore.FirebaseFirestore
import edu.dnyanshree.exam.ui.auth.AuthScreen
import edu.dnyanshree.exam.ui.main.MainScreen
import edu.dnyanshree.exam.ui.exam.ExamScreen
import edu.dnyanshree.exam.ui.common.AppVersionInfo
import edu.dnyanshree.exam.ui.common.ForceUpdateDialog

@Composable
fun MainNavigation() {
    var isAuthenticated by remember { mutableStateOf(com.google.firebase.auth.FirebaseAuth.getInstance().currentUser != null) }

    // App Update Monitoring
    var updateInfo by remember { mutableStateOf<AppVersionInfo?>(null) }
    var dismissedOptionalUpdate by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val firestore = FirebaseFirestore.getInstance()
            firestore.collection("settings").document("app_version")
                .addSnapshotListener { snapshot, error ->
                    if (error != null || snapshot == null || !snapshot.exists()) return@addSnapshotListener
                    val minVersion = snapshot.getLong("minRequiredVersionCode")?.toInt() ?: 1
                    val latestVersion = snapshot.getLong("latestVersionCode")?.toInt() ?: 1
                    val latestName = snapshot.getString("latestVersionName") ?: "1.0"
                    val url = snapshot.getString("apkDownloadUrl") ?: ""
                    val notes = snapshot.getString("releaseNotes") ?: ""
                    val isForce = snapshot.getBoolean("forceUpdate") ?: false

                    val currentVersionCode = BuildConfig.VERSION_CODE

                    val isMandatoryLock = isForce && (currentVersionCode < minVersion)
                    val isOptionalUpdate = !isForce && (currentVersionCode < latestVersion)

                    if (isMandatoryLock || isOptionalUpdate) {
                        updateInfo = AppVersionInfo(
                            minRequiredVersionCode = minVersion,
                            latestVersionCode = latestVersion,
                            latestVersionName = latestName,
                            apkDownloadUrl = url,
                            releaseNotes = notes,
                            forceUpdate = isMandatoryLock
                        )
                    } else {
                        updateInfo = null
                    }
                }
        } catch (e: Exception) {
            android.util.Log.w("MainNavigation", "Could not attach version listener: ${e.message}")
        }
    }

    // Render Update Dialog if applicable
    updateInfo?.let { info ->
        if (info.forceUpdate || !dismissedOptionalUpdate) {
            ForceUpdateDialog(
                versionInfo = info,
                onDismissOptional = {
                    dismissedOptionalUpdate = true
                }
            )
        }
    }

    // If mandatory force update is active, lock the underlying app completely
    val isAppLocked = updateInfo?.forceUpdate == true
    if (isAppLocked) {
        return
    }

    if (!isAuthenticated) {
        AuthScreen(onAuthSuccess = { isAuthenticated = true })
    } else {
        val backStack = rememberNavBackStack(Main)
        NavDisplay(
            backStack = backStack,
            onBack = { backStack.removeLastOrNull() },
            entryProvider = entryProvider {
                entry<Main> {
                    MainScreen(
                        onStartExam = { paperId ->
                            backStack.add(Exam(paperId))
                        },
                        onLogout = {
                            try {
                                com.google.firebase.auth.FirebaseAuth.getInstance().signOut()
                            } catch (e: Exception) {}
                            isAuthenticated = false
                        },
                        modifier = Modifier
                            .safeDrawingPadding()
                            .padding(16.dp)
                    )
                }
                entry<Exam> { examKey ->
                    ExamScreen(
                        paperId = examKey.paperId,
                        onExamFinished = {
                            // Back to main list after normal exam completion
                            backStack.removeLastOrNull()
                        },
                        onViolationSignOut = {
                            // Violation: sign out and go to login screen
                            try {
                                com.google.firebase.auth.FirebaseAuth.getInstance().signOut()
                            } catch (e: Exception) {}
                            isAuthenticated = false
                        },
                        modifier = Modifier
                            .safeDrawingPadding()
                            .padding(16.dp)
                    )
                }
            }
        )
    }
}
