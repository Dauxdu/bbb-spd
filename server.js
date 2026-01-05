const express = require("express")
const https = require("https")
const { spawn } = require("child_process")
const morgan = require("morgan")
const { v4: uuidv4 } = require("uuid")
const fs = require("fs")

const app = express()
const PORT = 3000

// Логирование
const logStream = fs.createWriteStream("access.log", { flags: "a" })
app.use(morgan("combined", { stream: logStream }))

app.use(express.json())
app.use(express.static("public"))

const handleError = (res, message, statusCode = 500) => {
  console.error(message)
  res.status(statusCode).send(message)
}

const httpGet = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          response.resume()
          reject(
            new Error(
              `HTTP GET request failed with status code ${response.statusCode}`
            )
          )
          return
        }
        let data = []
        response.on("data", (chunk) => data.push(chunk))
        response.on("end", () => resolve(Buffer.concat(data)))
      })
      .on("error", (err) =>
        reject(
          new Error(`Error during HTTP GET request for ${url}: ${err.message}`)
        )
      )
  })
}

const convertSvgToPdf = (svgBuffer) => {
  return new Promise((resolve, reject) => {
    const childProcess = spawn("rsvg-convert", ["-f", "pdf"])
    let pdfBuffer = Buffer.from([])
    let errorBuffer = Buffer.from([])

    childProcess.stdout.on(
      "data",
      (chunk) => (pdfBuffer = Buffer.concat([pdfBuffer, chunk]))
    )
    childProcess.stderr.on(
      "data",
      (chunk) => (errorBuffer = Buffer.concat([errorBuffer, chunk]))
    )
    childProcess.on("close", (code) =>
      code !== 0
        ? reject(
            new Error(`Error converting SVG to PDF: ${errorBuffer.toString()}`)
          )
        : resolve(pdfBuffer)
    )

    childProcess.stdin.write(svgBuffer)
    childProcess.stdin.end()
  })
}

const mergePdfs = (pdfBuffers) => {
  return new Promise((resolve, reject) => {
    const outputFile = `output_${uuidv4()}.pdf`
    const inputFiles = pdfBuffers.map((buffer, index) => {
      const inputFile = `input_${index}.pdf`
      fs.writeFileSync(inputFile, buffer)
      return inputFile
    })

    const childProcess = spawn("pdfunite", [...inputFiles, outputFile])
    let errorBuffer = Buffer.from([])

    childProcess.stderr.on(
      "data",
      (chunk) => (errorBuffer = Buffer.concat([errorBuffer, chunk]))
    )
    childProcess.on("close", (code) => {
      inputFiles.forEach((file) => fs.unlinkSync(file))
      code !== 0
        ? reject(new Error(`Error merging PDFs: ${errorBuffer.toString()}`))
        : resolve(fs.readFileSync(outputFile))
      fs.unlinkSync(outputFile)
    })
  })
}

app.post("/download", async (req, res) => {
  let { url: baseUrl, startIndex, endIndex } = req.body

  if (!baseUrl) return handleError(res, "Missing URL parameter", 400)

  console.log(
    `Download request received for URL: ${baseUrl}, Start: ${startIndex}, End: ${endIndex}`
  )

  try {
    let index = startIndex
    const pdfBuffers = []

    // Определение формата ссылки
    let slideFormat = "numeric"
    let basePath = ""

    if (baseUrl.includes("/svgs/")) {
      slideFormat = "slide"
      const svgsIndex = baseUrl.indexOf("/svgs/")
      basePath = baseUrl.substring(0, svgsIndex + 6)
    } else {
      basePath = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1)
      if (!basePath.endsWith("/")) basePath += "/"
      if (!basePath.includes("/svg/")) basePath += "svg/"
    }

    while (endIndex === -1 || index <= endIndex) {
      let svgUrl
      if (slideFormat === "slide") {
        svgUrl = `${basePath}slide${index}.svg`
      } else {
        svgUrl = `${basePath}${index}`
      }

      try {
        console.log(`Downloading slide ${index} from ${svgUrl}`)
        const svgBuffer = await httpGet(svgUrl)
        const pdfBuffer = await convertSvgToPdf(svgBuffer)
        pdfBuffers.push(pdfBuffer)
      } catch (error) {
        if (error.message && error.message.includes("404")) {
          console.warn(`Slide ${index} not found, stopping download.`)
          break
        }
        console.error(`Error processing slide ${index}: ${error.message}`)
        break
      }

      index++
    }

    if (pdfBuffers.length === 0)
      return handleError(
        res,
        "No slides were successfully downloaded and converted.",
        404
      )

    const mergedPdf = await mergePdfs(pdfBuffers)
    const outputFileName = `presentation_${uuidv4()}.pdf`

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${outputFileName}"`
    )
    res.setHeader("Content-Type", "application/pdf")
    res.send(mergedPdf)
    console.log(`File sent successfully.`)
  } catch (error) {
    handleError(res, `Error during download process: ${error.message}`)
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
