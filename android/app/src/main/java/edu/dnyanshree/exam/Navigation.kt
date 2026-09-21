package edu.dnyanshree.exam

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import edu.dnyanshree.exam.ui.auth.AuthScreen
import edu.dnyanshree.exam.ui.main.MainScreen
import edu.dnyanshree.exam.ui.exam.ExamScreen

@Composable
fun MainNavigation() {
    var isAuthenticated by remember { mutableStateOf(com.google.firebase.auth.FirebaseAuth.getInstance().currentUser != null) }

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
