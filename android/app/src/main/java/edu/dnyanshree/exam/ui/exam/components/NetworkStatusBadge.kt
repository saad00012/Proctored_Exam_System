package edu.dnyanshree.exam.ui.exam.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import edu.dnyanshree.exam.data.network.NetworkStatus

@Composable
fun NetworkStatusBadge(
    networkStatus: NetworkStatus,
    pendingSyncCount: Int,
    modifier: Modifier = Modifier
) {
    val isConnected = networkStatus.isConnected
    val isDegraded = networkStatus.isDegraded
    val hasPending = pendingSyncCount > 0

    val (badgeBg, badgeBorder, dotColor, badgeText, badgeIcon) = when {
        !isConnected -> Quintuple(
            Color(0xFFEF4444).copy(alpha = 0.15f),
            Color(0xFFEF4444).copy(alpha = 0.4f),
            Color(0xFFEF4444),
            "Offline (Vault Active)",
            Icons.Default.WifiOff
        )
        hasPending -> Quintuple(
            Color(0xFFF59E0B).copy(alpha = 0.15f),
            Color(0xFFF59E0B).copy(alpha = 0.4f),
            Color(0xFFF59E0B),
            "Syncing ($pendingSyncCount pending)",
            Icons.Default.CloudSync
        )
        isDegraded -> Quintuple(
            Color(0xFFF59E0B).copy(alpha = 0.12f),
            Color(0xFFF59E0B).copy(alpha = 0.3f),
            Color(0xFFF59E0B),
            "${networkStatus.latencyMs}ms",
            Icons.Default.Wifi
        )
        else -> Quintuple(
            Color(0xFF10B981).copy(alpha = 0.12f),
            Color(0xFF10B981).copy(alpha = 0.3f),
            Color(0xFF10B981),
            if (networkStatus.latencyMs > 0) "${networkStatus.latencyMs}ms" else "Online",
            Icons.Default.CloudDone
        )
    }

    Box(
        modifier = modifier
            .background(badgeBg, RoundedCornerShape(10.dp))
            .border(1.dp, badgeBorder, RoundedCornerShape(10.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
            Icon(
                imageVector = badgeIcon,
                contentDescription = null,
                tint = dotColor,
                modifier = Modifier.size(12.dp)
            )
            Text(
                text = badgeText,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = dotColor
            )
        }
    }
}

@Composable
fun OfflineWarningBanner(
    offlineDurationSeconds: Long,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = offlineDurationSeconds >= 20,
        enter = fadeIn(),
        exit = fadeOut(),
        modifier = modifier
    ) {
        Card(
            colors = CardDefaults.cardColors(
                containerColor = Color(0xFF7C2D12).copy(alpha = 0.95f)
            ),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.padding(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.WifiOff,
                    contentDescription = null,
                    tint = Color(0xFFFDBA74),
                    modifier = Modifier.size(20.dp)
                )
                Column {
                    Text(
                        text = "Network connection lost ($offlineDurationSeconds s)",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = "Your answers are being saved locally. Please reconnect to classroom Wi-Fi. Timer is running.",
                        fontSize = 11.sp,
                        color = Color(0xFFFED7AA)
                    )
                }
            }
        }
    }
}

private data class Quintuple<A, B, C, D, E>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D,
    val fifth: E
)
