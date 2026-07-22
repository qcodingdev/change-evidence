package dev.qcoding.changeevidence.i18n

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.text.MessageFormat
import java.util.Locale
import java.util.ResourceBundle

class LocalizationResourcesTest {
    @Test
    fun `english and chinese bundles expose the same keys`() {
        val english = bundle(Locale.ENGLISH)
        val chinese = bundle(Locale.SIMPLIFIED_CHINESE)

        assertEquals(english.keySet(), chinese.keySet())
        assertTrue(chinese.getString("commit.continue").contains("继续"))
        assertEquals(
            "AI Change Radar: Analyze Current Changes",
            english.getString("action.AIChangeRadar.AnalyzeCurrentChanges.text"),
        )
    }

    @Test
    fun `localized messages format all placeholders`() {
        val english = bundle(Locale.ENGLISH)
        val formatted = MessageFormat.format(
            english.getString("toolwindow.summary"),
            "High",
            2,
            10,
            3,
            4,
        )

        assertTrue(formatted.contains("High"))
        assertTrue(formatted.contains("Files: 2"))
    }

    private fun bundle(locale: Locale): ResourceBundle =
        ResourceBundle.getBundle("messages.ChangeEvidenceBundle", locale)
}
