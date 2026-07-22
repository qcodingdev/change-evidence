package dev.qcoding.changeevidence.actions

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class AnalyzeCurrentChangesAction : AnAction() {
    override fun actionPerformed(event: AnActionEvent) {
        event.project?.let(AnalysisRunner::runCurrentChanges)
    }

    override fun update(event: AnActionEvent) {
        event.presentation.isEnabled = event.project != null
    }

    override fun getActionUpdateThread(): ActionUpdateThread =
        ActionUpdateThread.BGT
}
