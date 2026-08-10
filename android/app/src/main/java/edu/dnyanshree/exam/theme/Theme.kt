package edu.dnyanshree.exam.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary              = Indigo500,
    onPrimary            = White,
    primaryContainer     = Indigo50,
    onPrimaryContainer   = Indigo600,

    secondary            = Violet500,
    onSecondary          = White,
    secondaryContainer   = Violet50,
    onSecondaryContainer = Violet500,

    background           = SurfaceLight,
    onBackground         = Gray900,

    surface              = White,
    onSurface            = Gray800,
    surfaceVariant       = Gray100,
    onSurfaceVariant     = Gray600,

    outline              = Gray200,
    outlineVariant       = Gray300,

    error                = Danger500,
    onError              = White,
    errorContainer       = Danger100,
    onErrorContainer     = Danger800,
)

@Composable
fun DnyanshreeExamAppTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography  = Typography,
        content     = content
    )
}
