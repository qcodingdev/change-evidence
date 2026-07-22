package dev.qcoding.changeevidence.services

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import dev.qcoding.changeevidence.analysis.RiskReport
import java.util.concurrent.CopyOnWriteArrayList

@Service(Service.Level.PROJECT)
class AnalysisReportService {
    private val listeners = CopyOnWriteArrayList<(RiskReport) -> Unit>()

    @Volatile
    var report: RiskReport = RiskReport.EMPTY
        private set

    fun update(newReport: RiskReport) {
        report = newReport
        val notify = Runnable {
            listeners.forEach { it(newReport) }
        }
        val application = ApplicationManager.getApplication()
        if (application.isDispatchThread) {
            notify.run()
        } else {
            application.invokeLater(notify)
        }
    }

    fun subscribe(parent: Disposable, listener: (RiskReport) -> Unit) {
        listeners += listener
        Disposer.register(parent) {
            listeners -= listener
        }
    }

    companion object {
        fun getInstance(project: Project): AnalysisReportService =
            project.getService(AnalysisReportService::class.java)
    }
}
