package edu.dnyanshree.exam.ui.exam.components

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight

@Composable
fun MalpracticeAlertDialog(
    warningCount: Int,
    reason: String,
    isHardlocked: Boolean,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = { /* Modal prevents dismissal by clicking outside */ },
        title = {
            Text(
                text = if (isHardlocked) "🚨 Session Hardlocked" else "⚠️ Proctoring Warning #$warningCount",
                color = if (isHardlocked) Color(0xFFEF4444) else Color(0xFFF59E0B),
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Text(
                text = if (isHardlocked) {
                    "You have exceeded the maximum warning threshold (3 warnings).\n\nReason: $reason\n\nYour session has been locked. Please notify your test proctor or supervisor to review and unlock your test."
                } else {
                    "A potential violation was detected during your exam session:\n\nReason: $reason\n\nWarning $warningCount of 3. Reaching 3 warnings will lock your session."
                }
            )
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isHardlocked) Color(0xFFEF4444) else Color(0xFFF59E0B)
                )
            ) {
                Text(if (isHardlocked) "Exit to Lobby" else "Acknowledge & Continue")
            }
        }
    )
}
