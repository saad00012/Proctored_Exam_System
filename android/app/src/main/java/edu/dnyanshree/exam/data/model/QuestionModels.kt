package edu.dnyanshree.exam.data.model

data class Question(
    val id: String,
    val questionText: String,
    val questionImageUrl: String? = null,
    val options: List<Option>,
    val correctOptionIndex: Int,
    val subject: String
)

data class Option(
    val text: String,
    val imageUrl: String? = null
)

data class ExamPaperItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val durationMinutes: Int,
    val questionCount: Int,
    val scheduleText: String,
    val userStatus: String, // "unstarted" | "started" | "submitted" | "blocked" | "failed" | "upcoming" | "expired" | "waiting_teacher"
    val targetPaperId: String,
    val isStarted: Boolean = false,
    val examOtp: String = ""
)

data class ScoreSummary(
    val score: Int,
    val total: Int,
    val percentage: Int,
    val elapsedSeconds: Int
)
