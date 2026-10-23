package app.aistylist.feature.capture.ui

import android.content.Context
import android.speech.tts.TextToSpeech

/**
 * Speech for the speaker button (Q-B) when no screen reader runs; with TalkBack the hint label's
 * live region speaks instead. The engine starts on first use and is released by [shutdown].
 */
internal class CaptureSpeaker(
    private val context: Context,
) {
    private var engine: TextToSpeech? = null
    private var isReady = false
    private var waiting: String? = null

    fun speak(text: String) {
        val current = engine
        if (current == null) {
            waiting = text
            engine =
                TextToSpeech(context.applicationContext) { status ->
                    isReady = status == TextToSpeech.SUCCESS
                    if (isReady) waiting?.let(::say)
                    waiting = null
                }
            return
        }
        if (isReady) say(text) else waiting = text
    }

    fun shutdown() {
        engine?.shutdown()
        engine = null
        isReady = false
        waiting = null
    }

    private fun say(text: String) {
        engine?.speak(text, TextToSpeech.QUEUE_FLUSH, null, UTTERANCE_ID)
    }

    private companion object {
        const val UTTERANCE_ID = "capture-hint"
    }
}
