package edu.dnyanshree.exam

import android.os.Bundle
import android.view.WindowManager
import android.app.assist.AssistContent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import edu.dnyanshree.exam.theme.DnyanshreeExamAppTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    edu.dnyanshree.exam.theme.ThemeManager.init(this)

    // Globally enforce screenshot and screen recording blocking, which also thwarts Assistant screenshots (Circle to Search)
    window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)

    enableEdgeToEdge()
    setContent {
      DnyanshreeExamAppTheme { Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { MainNavigation() } }
    }
  }

  // Clear assist data to prevent screen text analysis via Digital Assistant features
  override fun onProvideAssistData(data: Bundle?) {
    super.onProvideAssistData(data)
    data?.clear()
  }

  override fun onProvideAssistContent(assistContent: AssistContent?) {
    super.onProvideAssistContent(assistContent)
    try {
      assistContent?.intent = null
      assistContent?.webUri = null
      assistContent?.structuredData = null
    } catch (_: Exception) {}
  }
}
