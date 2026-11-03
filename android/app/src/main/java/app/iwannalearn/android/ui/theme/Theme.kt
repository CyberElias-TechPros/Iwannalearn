package app.iwannalearn.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import app.iwannalearn.android.R

val Brand = Color(0xFF0F6B4F)
val Paper = Color(0xFFFBF7EF)
val Ink = Color(0xFF17251F)
val Amber = Color(0xFFAD6517)
private val sans = FontFamily(Font(R.font.instrument_sans))
private val display = FontFamily(Font(R.font.fraunces))
private val Light = lightColorScheme(primary = Brand, onPrimary = Color.White, primaryContainer = Color(0xFFE3F1E9), onPrimaryContainer = Color(0xFF0A4C38), secondary = Amber, secondaryContainer = Color(0xFFFBEED9), onSecondaryContainer = Color(0xFF68400B), background = Paper, onBackground = Ink, surface = Color.White, onSurface = Ink, surfaceVariant = Color(0xFFF0EBE0), onSurfaceVariant = Color(0xFF53665B), outline = Color(0xFF8B988F), outlineVariant = Color(0xFFE7DFD0), error = Color(0xFFB23B2C), errorContainer = Color(0xFFFAE7E3))
private val Dark = darkColorScheme(primary = Color(0xFF91D4B5), onPrimary = Color(0xFF073827), primaryContainer = Color(0xFF1D4D3B), onPrimaryContainer = Color(0xFFD4F3E2), secondary = Color(0xFFE9BA65), secondaryContainer = Color(0xFF59411F), onSecondaryContainer = Color(0xFFFFDFAB), background = Color(0xFF121B16), onBackground = Color(0xFFE5EADF), surface = Color(0xFF1B2720), onSurface = Color(0xFFE5EADF), surfaceVariant = Color(0xFF2B382F), onSurfaceVariant = Color(0xFFB8C7BB), outline = Color(0xFF81958A), outlineVariant = Color(0xFF3A483F), error = Color(0xFFFFB4A7), errorContainer = Color(0xFF622C24))

@Composable fun IwannalearnTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val base = if (dark) Dark else Light
    MaterialTheme(colorScheme = base, typography = Typography(
        displayLarge = TextStyle(fontFamily = display, fontWeight = FontWeight.SemiBold, fontSize = 48.sp, lineHeight = 52.sp, letterSpacing = (-1).sp),
        displayMedium = TextStyle(fontFamily = display, fontWeight = FontWeight.SemiBold, fontSize = 40.sp, lineHeight = 44.sp),
        displaySmall = TextStyle(fontFamily = display, fontWeight = FontWeight.SemiBold, fontSize = 32.sp, lineHeight = 38.sp),
        headlineLarge = TextStyle(fontFamily = display, fontWeight = FontWeight.SemiBold, fontSize = 30.sp, lineHeight = 36.sp),
        headlineMedium = TextStyle(fontFamily = display, fontWeight = FontWeight.SemiBold, fontSize = 26.sp, lineHeight = 32.sp),
        headlineSmall = TextStyle(fontFamily = display, fontWeight = FontWeight.SemiBold, fontSize = 23.sp, lineHeight = 29.sp),
        titleLarge = TextStyle(fontFamily = sans, fontWeight = FontWeight.SemiBold, fontSize = 21.sp, lineHeight = 27.sp),
        titleMedium = TextStyle(fontFamily = sans, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, lineHeight = 23.sp),
        titleSmall = TextStyle(fontFamily = sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
        bodyLarge = TextStyle(fontFamily = sans, fontSize = 16.sp, lineHeight = 25.sp),
        bodyMedium = TextStyle(fontFamily = sans, fontSize = 14.sp, lineHeight = 21.sp),
        bodySmall = TextStyle(fontFamily = sans, fontSize = 12.sp, lineHeight = 18.sp),
        labelLarge = TextStyle(fontFamily = sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
        labelMedium = TextStyle(fontFamily = sans, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 17.sp),
        labelSmall = TextStyle(fontFamily = sans, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 16.sp),
    ), shapes = Shapes(extraSmall = RoundedCornerShape(8.dp), small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(18.dp), large = RoundedCornerShape(24.dp), extraLarge = RoundedCornerShape(30.dp)), content = content)
}
