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
    // Disable login system for development phase
    var isAuthenticated by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        isAuthenticated = true
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
                            } catch (e: Exception) {
                                // Mock signout
                            }
                            // Keep authenticated as true during development phase
                            isAuthenticated = true
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
                            // Back to main list
                            backStack.removeLastOrNull()
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
