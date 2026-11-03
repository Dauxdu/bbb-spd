const express = require("express")
const https = require("https")
const dns = require("dns").promises
const net = require("net")
const { spawn } = require("child_process")
const morgan = require("morgan")
const { v4: uuidv4 } = require("uuid")
const os = require("os")
const path = require("path")
const fs = require("fs")

const PORT = Number.parseInt(process.env.PORT, 10) || 3000
const MAX_SLIDES = 500
const MAX_INDEX = 9999
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 15000

const app = express()

// Логирование
app.use(morgan("combined"))
app.use(express.json())
app.use(express.static("public"))

const handleError = (res, message, statusCode = 500, logDetail) => {
  if (logDetail !== undefined) console.error(logDetail)
  res.status(statusCode).send(message)
}

const isPrivateIpv4 = (ip) => {
  const octets = ip.split(".").map(Number)
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
    return true
  }
  const [a, b, c] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

const isPrivateIpv6 = (ip) => {
  const normalized = ip.toLowerCase()
  if (normalized.startsWith("::ffff:")) {
    const tail = normalized.slice(7)
    if (tail.includes(".")) return isPrivateIpv4(tail)
    const groups = tail.split(":").map((group) => Number.parseInt(group, 16))
    if (groups.length === 2 && groups.every((group) => !Number.isNaN(group))) {
      return isPrivateIpv4(
        `${groups[0] >> 8}.${groups[0] & 0xff}.${groups[1] >> 8}.${groups[1] & 0xff}`,
      )
    }
    return true
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("64:ff9b:")
  )
}

const isPublicIp = (ip) => {
  if (net.isIPv4(ip)) return !isPrivateIpv4(ip)
  if (net.isIPv6(ip)) return !isPrivateIpv6(ip)
  return false
}

const guardedLookup = (hostname, options, callback) => {
  dns
    .lookup(hostname, { ...options, all: true })
    .then((records) => {
      const publicRecords = records.filter((record) =>
        isPublicIp(record.address),
      )
      if (publicRecords.length === 0) {
        callback(
          new Error(`Blocked private address resolution for ${hostname}`),
        )
        return
      }
      if (options && options.all) {
        callback(null, publicRecords)
        return
      }
      callback(null, publicRecords[0].address, publicRecords[0].family)
    })
    .catch((err) => callback(err))
}

const isAllowedUrl = (url) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return false
    if (parsed.username !== "" || parsed.password !== "") return false
    if (parsed.port !== "" && parsed.port !== "443") return false
    if (parsed.hostname === "") return false
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "")
    if (net.isIP(hostname)) return isPublicIp(hostname)
    return true
  } catch {
    return false
  }
}

const httpGet = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          lookup: guardedLookup,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
        (response) => {
          if (response.statusCode !== 200) {
            response.resume()
            reject(
              new Error(
                `HTTP GET request failed with status code ${response.statusCode}`,
              ),
            )
            return
          }
          const data = []
          let receivedBytes = 0
          response.on("data", (chunk) => {
            receivedBytes += chunk.length
            if (receivedBytes > MAX_RESPONSE_BYTES) {
              response.destroy(
                new Error(`Response exceeds ${MAX_RESPONSE_BYTES} bytes`),
              )
              return
            }
            data.push(chunk)
          })
          response.on("end", () => resolve(Buffer.concat(data)))
          response.on("error", (err) =>
            reject(
              new Error(
                `Error during HTTP GET request for ${url}: ${err.message}`,
              ),
            ),
          )
        },
      )
      .on("error", (err) =>
        reject(
          new Error(`Error during HTTP GET request for ${url}: ${err.message}`),
        ),
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
      (chunk) => (pdfBuffer = Buffer.concat([pdfBuffer, chunk])),
    )
    childProcess.stderr.on(
      "data",
      (chunk) => (errorBuffer = Buffer.concat([errorBuffer, chunk])),
    )
    childProcess.on("close", (code) =>
      code !== 0
        ? reject(
            new Error(`Error converting SVG to PDF: ${errorBuffer.toString()}`),
          )
        : resolve(pdfBuffer),
    )

    childProcess.stdin.write(svgBuffer)
    childProcess.stdin.end()
  })
}

const removeFile = (file) => {
  try {
    fs.unlinkSync(file)
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`Failed to remove file ${file}: ${err.message}`)
    }
  }
}

const mergePdfs = (pdfBuffers) => {
  return new Promise((resolve, reject) => {
    const requestId = uuidv4()
    const outputFile = path.join(os.tmpdir(), `output_${requestId}.pdf`)
    const inputFiles = pdfBuffers.map((buffer, index) => {
      const inputFile = path.join(
        os.tmpdir(),
        `input_${requestId}_${index}.pdf`,
      )
      fs.writeFileSync(inputFile, buffer)
      return inputFile
    })

    const childProcess = spawn("pdfunite", [...inputFiles, outputFile])
    let errorBuffer = Buffer.from([])

    childProcess.stderr.on(
      "data",
      (chunk) => (errorBuffer = Buffer.concat([errorBuffer, chunk])),
    )
    childProcess.on("close", (code) => {
      inputFiles.forEach((file) => removeFile(file))
      if (code !== 0) {
        removeFile(outputFile)
        reject(new Error(`Error merging PDFs: ${errorBuffer.toString()}`))
        return
      }
      const mergedPdf = fs.readFileSync(outputFile)
      removeFile(outputFile)
      resolve(mergedPdf)
    })
  })
}

app.post("/download", async (req, res) => {
  const { url: baseUrl, startIndex, endIndex } = req.body

  if (typeof baseUrl !== "string" || baseUrl === "") {
    return handleError(res, "Missing URL parameter", 400)
  }
  if (!isAllowedUrl(baseUrl)) {
    return handleError(res, "URL is not allowed", 400)
  }
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
    return handleError(res, "Slide indexes must be integers", 400)
  }
  if (
    startIndex < 1 ||
    startIndex > MAX_INDEX ||
    endIndex > MAX_INDEX ||
    (endIndex !== -1 &&
      (endIndex < startIndex || endIndex - startIndex + 1 > MAX_SLIDES))
  ) {
    return handleError(res, "Slide indexes are out of allowed range", 400)
  }

  console.log(
    `Download request received for URL: ${baseUrl}, Start: ${startIndex}, End: ${endIndex}`,
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

    while (
      pdfBuffers.length < MAX_SLIDES &&
      (endIndex === -1 || index <= endIndex)
    ) {
      const svgUrl =
        slideFormat === "slide"
          ? `${basePath}slide${index}.svg`
          : `${basePath}${index}`

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

    if (pdfBuffers.length === 0) {
      return handleError(
        res,
        "No slides were successfully downloaded and converted.",
        404,
      )
    }

    const mergedPdf = await mergePdfs(pdfBuffers)
    const outputFileName = `presentation_${uuidv4()}.pdf`

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${outputFileName}"`,
    )
    res.setHeader("Content-Type", "application/pdf")
    res.send(mergedPdf)
    console.log(`File sent successfully.`)
  } catch (error) {
    handleError(
      res,
      "Internal server error",
      500,
      `Error during download process: ${error.message}`,
    )
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
