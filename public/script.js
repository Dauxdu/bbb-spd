document.addEventListener("DOMContentLoaded", () => {
  const allSlidesCheckbox = document.getElementById("allSlides")
  const slideRangeDiv = document.getElementById("slideRange")
  const startSlideInput = document.getElementById("startSlide")
  const endSlideInput = document.getElementById("endSlide")
  const downloadForm = document.getElementById("downloadForm")
  const messageDiv = document.getElementById("message")
  const themeToggle = document.getElementById("theme-toggle")
  const body = document.body

  // Переключение темы
  function toggleTheme() {
    body.classList.toggle("dark-theme")
    localStorage.setItem(
      "theme",
      body.classList.contains("dark-theme") ? "dark" : "light"
    )
  }

  // Проверка сохраненной темы
  const savedTheme = localStorage.getItem("theme")
  if (savedTheme === "dark") body.classList.add("dark-theme")

  // Обработчик переключения темы
  themeToggle.addEventListener("click", toggleTheme)

  // Показать/скрыть диапазон слайдов
  function toggleSlideRangeVisibility() {
    const isHidden = allSlidesCheckbox.checked
    slideRangeDiv.classList.toggle("hidden", isHidden)
    startSlideInput.required = !isHidden
    endSlideInput.required = !isHidden
  }

  allSlidesCheckbox.addEventListener("change", toggleSlideRangeVisibility)
  toggleSlideRangeVisibility() // Инициализация при загрузке

  // Обработка отправки формы
  downloadForm.addEventListener("submit", async (event) => {
    event.preventDefault()

    const presentationLink = document.getElementById("presentationLink").value
    const fileName = document.getElementById("fileName").value
    let startSlide = 1
    let endSlide = -1

    if (!allSlidesCheckbox.checked) {
      startSlide = parseInt(startSlideInput.value) || 1
      endSlide = parseInt(endSlideInput.value) || -1
    }

    // Валидация
    if (isNaN(startSlide) || isNaN(endSlide)) {
      showMessage("Пожалуйста, введите корректные номера слайдов.", "error")
      return
    }

    if (endSlide !== -1 && startSlide > endSlide) {
      showMessage("Начальный слайд не может быть больше конечного.", "error")
      return
    }

    showMessage("Идет загрузка...", "info")

    try {
      const response = await fetch("/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: presentationLink,
          startIndex: startSlide,
          endIndex: endSlide,
        }),
      })

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`)

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${fileName}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      showMessage("Презентация успешно загружена!", "success")
    } catch (error) {
      console.error("Ошибка:", error)
      showMessage(`Произошла ошибка: ${error.message}`, "error")
    }
  })

  // Показать сообщение
  function showMessage(message, type = "info") {
    messageDiv.textContent = message
    messageDiv.className = `message ${type}`
  }
})
