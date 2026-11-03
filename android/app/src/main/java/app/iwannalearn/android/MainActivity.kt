package app.iwannalearn.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import app.iwannalearn.android.ui.AppRoot
import app.iwannalearn.android.ui.theme.IwannalearnTheme
import kotlinx.coroutines.flow.MutableStateFlow

class MainActivity : ComponentActivity() {
    val incomingIntent = MutableStateFlow<Intent?>(null)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        incomingIntent.value = intent
        setContent { IwannalearnTheme { AppRoot(incomingIntent) } }
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); incomingIntent.value = intent }
}
