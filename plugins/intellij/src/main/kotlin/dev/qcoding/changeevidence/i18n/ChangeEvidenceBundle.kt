package dev.qcoding.changeevidence.i18n

import com.intellij.DynamicBundle
import dev.qcoding.changeevidence.analysis.RiskFinding
import dev.qcoding.changeevidence.analysis.RiskLevel
import org.jetbrains.annotations.Nls
import org.jetbrains.annotations.PropertyKey

private const val BUNDLE = "messages.ChangeEvidenceBundle"

object ChangeEvidenceBundle : DynamicBundle(BUNDLE) {
    @JvmStatic
    @Nls
    fun message(
        @PropertyKey(resourceBundle = BUNDLE) key: String,
        vararg params: Any,
    ): String = getMessage(key, *params)

    fun riskLevel(level: RiskLevel): String =
        message("risk.level.${level.name.lowercase()}")

    fun finding(finding: RiskFinding): String =
        message(finding.messageKey, *finding.messageArguments.toTypedArray())

    fun rule(ruleId: String): String =
        message("rule.$ruleId")
}
