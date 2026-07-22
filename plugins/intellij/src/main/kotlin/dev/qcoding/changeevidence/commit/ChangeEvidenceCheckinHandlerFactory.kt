package dev.qcoding.changeevidence.commit

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.util.ThrowableComputable
import com.intellij.openapi.vcs.CheckinProjectPanel
import com.intellij.openapi.vcs.changes.CommitContext
import com.intellij.openapi.vcs.checkin.CheckinHandler
import com.intellij.openapi.vcs.checkin.CheckinHandlerFactory
import dev.qcoding.changeevidence.actions.AnalysisRunner
import dev.qcoding.changeevidence.analysis.RiskEngine
import dev.qcoding.changeevidence.analysis.RiskLevel
import dev.qcoding.changeevidence.analysis.RiskReport
import dev.qcoding.changeevidence.i18n.ChangeEvidenceBundle
import dev.qcoding.changeevidence.services.AnalysisReportService
import dev.qcoding.changeevidence.vcs.ChangeCollector

class ChangeEvidenceCheckinHandlerFactory : CheckinHandlerFactory() {
    override fun createHandler(
        panel: CheckinProjectPanel,
        commitContext: CommitContext,
    ): CheckinHandler = ChangeEvidenceCheckinHandler(panel)
}

private class ChangeEvidenceCheckinHandler(
    private val panel: CheckinProjectPanel,
) : CheckinHandler() {
    override fun beforeCheckin(): ReturnResult {
        val changes = panel.selectedChanges
        if (changes.isEmpty()) return ReturnResult.COMMIT

        val project = panel.project
        val report = try {
            ProgressManager.getInstance().runProcessWithProgressSynchronously(
                ThrowableComputable<RiskReport, RuntimeException> {
                    RiskEngine().analyze(ChangeCollector.collect(changes, project.basePath))
                },
                ChangeEvidenceBundle.message("commit.progress"),
                true,
                project,
            )
        } catch (_: com.intellij.openapi.progress.ProcessCanceledException) {
            return ReturnResult.CANCEL
        } catch (error: RuntimeException) {
            Messages.showErrorDialog(
                project,
                ChangeEvidenceBundle.message(
                    "analysis.error.message",
                    error.message ?: error.javaClass.simpleName,
                ),
                ChangeEvidenceBundle.message("analysis.error.title"),
            )
            return ReturnResult.CANCEL
        }

        AnalysisReportService.getInstance(project).update(report)
        ApplicationManager.getApplication().invokeLater {
            AnalysisRunner.showToolWindow(project)
        }

        if (report.overallLevel.rank < RiskLevel.MEDIUM.rank) {
            return ReturnResult.COMMIT
        }

        val answer = Messages.showYesNoDialog(
            project,
            ChangeEvidenceBundle.message(
                "commit.dialog.message",
                report.findings.size,
                report.files.size,
                ChangeEvidenceBundle.riskLevel(report.overallLevel),
            ),
            ChangeEvidenceBundle.message(
                "commit.dialog.title",
                ChangeEvidenceBundle.riskLevel(report.overallLevel),
            ),
            ChangeEvidenceBundle.message("commit.continue"),
            ChangeEvidenceBundle.message("commit.cancel"),
            Messages.getWarningIcon(),
        )
        return if (answer == Messages.YES) ReturnResult.COMMIT else ReturnResult.CANCEL
    }
}
