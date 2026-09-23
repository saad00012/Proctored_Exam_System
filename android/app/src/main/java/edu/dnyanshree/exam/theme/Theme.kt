package edu.dnyanshree.exam.theme

import android.content.Context
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color

enum class ThemeMode {
    LIGHT, DARK, SYSTEM
}

object ThemeManager {
    private const val PREFS_NAME = "diet_theme_prefs"
    private const val KEY_THEME = "app_theme_mode"

    var currentThemeMode by mutableStateOf(ThemeMode.SYSTEM)
        private set

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_THEME, ThemeMode.SYSTEM.name) ?: ThemeMode.SYSTEM.name
        currentThemeMode = try {
            ThemeMode.valueOf(saved)
        } catch (_: Exception) {
            ThemeMode.SYSTEM
        }
    }

    fun setTheme(context: Context, mode: ThemeMode) {
        currentThemeMode = mode
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_THEME, mode.name).apply()
    }
}

private val LightColorScheme = lightColorScheme(
    primary              = Blue600,
    onPrimary            = White,
    primaryContainer     = Blue50,
    onPrimaryContainer   = Blue600,

    secondary            = Indigo500,
    onSecondary          = White,
    secondaryContainer   = Indigo50,
    onSecondaryContainer = Indigo600,

    background           = SurfaceLight,
    onBackground         = Gray900,

    surface              = White,
    onSurface            = Gray900,
    surfaceVariant       = Gray100,
    onSurfaceVariant     = Gray600,

    outline              = Gray200,
    outlineVariant       = Gray300,

    error                = Danger500,
    onError              = White,
    errorContainer       = Danger100,
    onErrorContainer     = Danger800,
)

private val DarkColorScheme = darkColorScheme(
    primary              = Blue500,
    onPrimary            = White,
    primaryContainer     = Color(0xFF1E3A8A),
    onPrimaryContainer   = Color(0xFFBFDBFE),

    secondary            = Indigo500,
    onSecondary          = White,
    secondaryContainer   = Color(0xFF312E81),
    onSecondaryContainer = Color(0xFFC7D2FE),

    background           = DarkBackground,
    onBackground         = DarkTextPrimary,

    surface              = DarkSurface,
    onSurface            = DarkTextPrimary,
    surfaceVariant       = DarkSurfaceVariant,
    onSurfaceVariant     = DarkTextSecondary,

    outline              = DarkBorder,
    outlineVariant       = DarkSurfaceElevated,

    error                = Danger500,
    onError              = White,
    errorContainer       = Color(0xFF7F1D1D),
    onErrorContainer     = Color(0xFFFECACA),
)

@Composable
fun DnyanshreeExamAppTheme(
    themeMode: ThemeMode = ThemeManager.currentThemeMode,
    content: @Composable () -> Unit
) {
    val isDark = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }

    MaterialTheme(
        colorScheme = if (isDark) DarkColorScheme else LightColorScheme,
        typography  = Typography,
        content     = content
    )
}
