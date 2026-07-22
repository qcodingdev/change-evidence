package dev.qcoding.changeevidence.vcs

import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vcs.FilePath
import com.intellij.openapi.vcs.VcsException
import com.intellij.openapi.vcs.changes.Change
import com.intellij.openapi.vcs.changes.ChangeListManager
import com.intellij.openapi.vcs.changes.ContentRevision
import dev.qcoding.changeevidence.analysis.ChangeStatus
import dev.qcoding.changeevidence.analysis.ChangedFile
import java.nio.file.Path
import kotlin.io.path.Path

object ChangeCollector {
    private const val MAX_TEXT_BYTES = 2L * 1024 * 1024

    fun collectCurrent(project: Project): List<ChangedFile> {
        val manager = ChangeListManager.getInstance(project)
        val changes = collect(manager.allChanges, project.basePath)
        val versionedPaths = changes.mapTo(HashSet()) { normalizeAbsolute(it.path, project.basePath) }
        val unversioned = manager.unversionedFilesPaths
            .asSequence()
            .filterNot { normalizeAbsolute(it.path, project.basePath) in versionedPaths }
            .map { collectUnversioned(it, project.basePath) }
            .toList()
        return changes + unversioned
    }

    fun collect(
        changes: Collection<Change>,
        basePath: String?,
    ): List<ChangedFile> = changes.map { change ->
        ProgressManager.checkCanceled()
        val revision = change.afterRevision ?: change.beforeRevision
        val absolutePath = revision?.file?.path.orEmpty()
        val before = readRevision(change.beforeRevision)
        val after = readRevision(change.afterRevision)
        ChangedFile(
            path = relativePath(absolutePath, basePath),
            status = when (change.type) {
                Change.Type.NEW -> ChangeStatus.ADDED
                Change.Type.DELETED -> ChangeStatus.DELETED
                Change.Type.MOVED -> ChangeStatus.MOVED
                Change.Type.MODIFICATION -> ChangeStatus.MODIFIED
            },
            beforeContent = before.content,
            afterContent = after.content,
            contentAvailable = before.available && after.available,
        )
    }

    private fun collectUnversioned(filePath: FilePath, basePath: String?): ChangedFile {
        ProgressManager.checkCanceled()
        val virtualFile = filePath.virtualFile
        val canRead = virtualFile != null &&
            !virtualFile.isDirectory &&
            !virtualFile.fileType.isBinary &&
            virtualFile.length <= MAX_TEXT_BYTES
        val content = if (canRead) {
            runCatching {
                virtualFile.contentsToByteArray(false).toString(virtualFile.charset)
            }.getOrNull()
        } else {
            null
        }
        return ChangedFile(
            path = relativePath(filePath.path, basePath),
            status = ChangeStatus.ADDED,
            beforeContent = null,
            afterContent = content,
            contentAvailable = content != null,
        )
    }

    private data class RevisionContent(
        val content: String?,
        val available: Boolean,
    )

    private fun readRevision(revision: ContentRevision?): RevisionContent {
        if (revision == null) return RevisionContent(null, true)
        val filePath = revision.file
        val virtualFile = filePath.virtualFile
        val localFile = filePath.ioFile
        val isKnownBinary = filePath.fileType.isBinary
        val knownLength = when {
            virtualFile != null -> virtualFile.length
            localFile.exists() -> localFile.length()
            else -> null
        }
        if (isKnownBinary || knownLength == null || knownLength > MAX_TEXT_BYTES) {
            return RevisionContent(null, false)
        }
        return try {
            val content = revision.content
            RevisionContent(content, content != null)
        } catch (_: VcsException) {
            RevisionContent(null, false)
        }
    }

    private fun relativePath(path: String, basePath: String?): String {
        if (path.isBlank() || basePath.isNullOrBlank()) return path.replace('\\', '/')
        return try {
            val base = Path(basePath).toAbsolutePath().normalize()
            val absolute = Path(path).toAbsolutePath().normalize()
            if (absolute.startsWith(base)) {
                base.relativize(absolute).toString().replace('\\', '/')
            } else {
                absolute.toString().replace('\\', '/')
            }
        } catch (_: Exception) {
            path.replace('\\', '/')
        }
    }

    private fun normalizeAbsolute(path: String, basePath: String?): Path =
        try {
            val value = Path(path)
            if (value.isAbsolute || basePath == null) {
                value.toAbsolutePath().normalize()
            } else {
                Path(basePath).resolve(value).toAbsolutePath().normalize()
            }
        } catch (_: Exception) {
            Path(path)
        }
}
