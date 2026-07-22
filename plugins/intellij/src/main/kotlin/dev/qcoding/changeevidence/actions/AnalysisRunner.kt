package dev.qcoding.changeevidence.actions

import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager
import dev.qcoding.changeevidence.analysis.RiskEngine
import dev.qcoding.changeevidence.analysis.RiskReport
import dev.qcoding.changeevidence.i18n.ChangeEvidenceBundle
import dev.qcoding.changeevidence.services.AnalysisReportService
import dev.qcoding.changeevidence.ui.ChangeEvidenceToolWindowFactory
import dev.qcoding.changeevidence.vcs.ChangeCollector

object AnalysisRunner {
    fun runCurrentChanges(project: Project) {
        object : Task.Backgroundable(
            project,
            ChangeEvidenceBundle.message("analysis.progress"),
            true,
        ) {
            private var result: RiskReport = RiskReport.EMPTY

            override fun run(indicator: ProgressIndicator) {
                indicator.isIndeterminate = true
                result = RiskEngine().analyze(ChangeCollector.collectCurrent(project))
            }

            override fun onSuccess() {
                AnalysisReportService.getInstance(project).update(result)
                showToolWindow(project)
                if (result.files.isEmpty()) {
                    Messages.showInfoMessage(
                        project,
                        ChangeEvidenceBundle.message("analysis.none.message"),
                        ChangeEvidenceBundle.message("analysis.none.title"),
                    )
                }
            }

            override fun onThrowable(error: Throwable) {
                Messages.showErrorDialog(
                    project,
                    ChangeEvidenceBundle.message(
                        "analysis.error.message",
                        error.message ?: error.javaClass.simpleName,
                    ),
                    ChangeEvidenceBundle.message("analysis.error.title"),
                )
            }
        }.queue()
    }

    fun showToolWindow(project: Project) {
        ToolWindowManager.getInstance(project)
            .getToolWindow(ChangeEvidenceToolWindowFactory.ID)
            ?.show()
    }
}
