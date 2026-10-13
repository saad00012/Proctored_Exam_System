package edu.dnyanshree.exam.ui.common

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class AppVersionInfo(
    val minRequiredVersionCode: Int = 1,
    val latestVersionCode: Int = 1,
    val latestVersionName: String = "1.0",
    val apkDownloadUrl: String = "",
    val releaseNotes: String = "",
    val forceUpdate: Boolean = false
)

private fun installApk(context: Context, apkFile: File) {
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.packageManager.canRequestPackageInstalls()) {
                val settingsIntent = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${context.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(settingsIntent)
                return
            }
        }

        val apkUri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            apkFile
        )
        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(installIntent)
    } catch (e: Exception) {
        android.util.Log.e("ForceUpdateDialog", "Error launching APK install: ${e.message}", e)
    }
}

private fun openInBrowser(context: Context, url: String) {
    try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        android.util.Log.e("ForceUpdateDialog", "Cannot open browser: ${e.message}")
    }
}

@Composable
fun ForceUpdateDialog(
    versionInfo: AppVersionInfo,
    onDismissOptional: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val isMandatory = versionInfo.forceUpdate

    var isDownloading by remember { mutableStateOf(false) }
    var downloadProgress by remember { mutableStateOf(0f) }
    var downloadedBytesText by remember { mutableStateOf("") }
    var downloadError by remember { mutableStateOf<String?>(null) }
    var downloadedApkFile by remember { mutableStateOf<File?>(null) }

    fun startDownloadAndInstall() {
        if (versionInfo.apkDownloadUrl.isBlank()) return

        val cachedFile = downloadedApkFile
        if (cachedFile != null && cachedFile.exists()) {
            installApk(context, cachedFile)
            return
        }

        isDownloading = true
        downloadProgress = 0f
        downloadError = null

        coroutineScope.launch {
            try {
                val apkFile = withContext(Dispatchers.IO) {
                    val url = URL(versionInfo.apkDownloadUrl)
                    val connection = (url.openConnection() as HttpURLConnection).apply {
                        connectTimeout = 15000
                        readTimeout = 30000
                        instanceFollowRedirects = true
                    }
                    connection.connect()

                    val responseCode = connection.responseCode
                    if (responseCode !in 200..299) {
                        throw Exception("Server returned HTTP $responseCode")
                    }

                    val fileLength = connection.contentLength
                    val targetDir = File(context.cacheDir, "updates").apply { mkdirs() }
                    val targetFile = File(targetDir, "update_${versionInfo.latestVersionCode}.apk")

                    connection.inputStream.use { input ->
                        FileOutputStream(targetFile).use { output ->
                            val buffer = ByteArray(8192)
                            var total: Long = 0
                            var count: Int
                            while (input.read(buffer).also { count = it } != -1) {
                                total += count
                                output.write(buffer, 0, count)
                                if (fileLength > 0) {
                                    val progress = total.toFloat() / fileLength.toFloat()
                                    withContext(Dispatchers.Main) {
                                        downloadProgress = progress
                                        val mbTotal = String.format("%.1f", fileLength / (1024f * 1024f))
                                        val mbCurrent = String.format("%.1f", total / (1024f * 1024f))
                                        downloadedBytesText = "$mbCurrent MB / $mbTotal MB"
                                    }
                                }
                            }
                        }
                    }
                    targetFile
                }

                downloadedApkFile = apkFile
                isDownloading = false
                installApk(context, apkFile)
            } catch (e: Exception) {
                isDownloading = false
                downloadError = "Download failed: ${e.localizedMessage ?: "Unknown error"}"
                android.util.Log.e("ForceUpdateDialog", "In-app download failed", e)
            }
        }
    }

    Dialog(
        onDismissRequest = {
            if (!isMandatory && !isDownloading) {
                onDismissOptional?.invoke()
            }
        },
        properties = DialogProperties(
            dismissOnBackPress = !isMandatory && !isDownloading,
            dismissOnClickOutside = !isMandatory && !isDownloading
        )
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .background(
                            if (isMandatory) MaterialTheme.colorScheme.errorContainer
                            else MaterialTheme.colorScheme.primaryContainer,
                            shape = RoundedCornerShape(30.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = if (isMandatory) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Text(
                    text = if (isMandatory) "App Update Required" else "New Version Available",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Text(
                    text = "A new version (${versionInfo.latestVersionName}) of the Proctored Exam app is available.",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (versionInfo.releaseNotes.isNotBlank()) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "What's New:",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = versionInfo.releaseNotes,
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }

                if (isMandatory) {
                    Text(
                        text = "Your current version is deprecated and cannot be used to take exams. Please update now to continue.",
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.error
                    )
                }

                // In-App Download Progress Section
                if (isDownloading) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                RoundedCornerShape(12.dp)
                            )
                            .padding(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Downloading update...",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "${(downloadProgress * 100).toInt()}%",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        LinearProgressIndicator(
                            progress = { downloadProgress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp),
                        )
                        if (downloadedBytesText.isNotBlank()) {
                            Text(
                                text = downloadedBytesText,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                if (downloadError != null) {
                    Text(
                        text = downloadError ?: "",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center
                    )
                }

                // Action Buttons
                Button(
                    onClick = {
                        startDownloadAndInstall()
                    },
                    enabled = !isDownloading && versionInfo.apkDownloadUrl.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Text(
                        when {
                            isDownloading -> "Downloading..."
                            downloadedApkFile != null -> "🚀 Install Update Now"
                            else -> "⬇️ Download & Install Update"
                        },
                        fontWeight = FontWeight.Bold
                    )
                }

                // Fallback direct browser download button
                if (downloadError != null || !isMandatory) {
                    OutlinedButton(
                        onClick = {
                            if (versionInfo.apkDownloadUrl.isNotBlank()) {
                                openInBrowser(context, versionInfo.apkDownloadUrl)
                            }
                        },
                        enabled = !isDownloading && versionInfo.apkDownloadUrl.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("🌐 Open Download in Browser", fontSize = 13.sp)
                    }
                }

                if (!isMandatory && onDismissOptional != null && !isDownloading) {
                    TextButton(
                        onClick = onDismissOptional,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Later", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}
