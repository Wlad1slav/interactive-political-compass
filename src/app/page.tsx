"use client"

import type React from "react"

import { useState, useRef, useEffect, FormEvent } from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { X } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { saveAs } from 'file-saver';
import { imageFileToBase64 } from "@/lib/utils"

interface Position {
  x: number
  y: number
}

interface ImageItem {
  id: string
  src?: string
  position: Position
  isDragging: boolean
  loading?: boolean
  base64: string;
}

const backgroundAssets = [
  '/Political_Compass_standard_model.svg.png'
];

export default function AlignmentChart() {
  const [images, setImages] = useState<ImageItem[]>([])
  const chartRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 })
  const [imageSize, setImageSize] = useState(80) // Default size, will be updated based on chart width
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [background, setBackground] = useState<string>()

  const [axis, setAxisNames] = useState({
    right: 'Right',
    top: 'Authoritarian',
    left: 'Left',
    bottom: 'Libertarian'
  });


  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // Update chart size to fit the screen
  useEffect(() => {
    const updateChartSize = () => {
      if (containerRef.current && chartRef.current) {
        // Get viewport dimensions
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        const isMobileView = viewportWidth < 768

        // Reserve space for input and padding (adjusted for mobile)
        const reservedVerticalSpace = isMobileView ? 120 : 140
        const topPadding = isMobileView ? 20 : 0 // Add top padding for mobile
        const availableHeight = viewportHeight - reservedVerticalSpace - topPadding

        // Calculate available width (with padding)
        const horizontalPadding = isMobileView
          ? Math.max(50, viewportWidth * 0.1) // More padding on mobile: at least 50px or 10% of viewport
          : Math.max(20, viewportWidth * 0.05) // Desktop: at least 20px or 5% of viewport
        const availableWidth = viewportWidth - horizontalPadding * 2

        // Determine chart size (square but constrained by available space)
        const size = Math.min(availableWidth, availableHeight)

        setChartSize({ width: size, height: size })

        // Update image size based on new chart dimensions
        const newImageSize = Math.max(40, Math.min(80, size / 7.5))
        setImageSize(newImageSize)
      }
    }

    // Set up ResizeObserver to monitor container size changes
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        updateChartSize()
      })

      resizeObserver.observe(containerRef.current)

      // Initial size calculation
      updateChartSize()

      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current)
        }
        resizeObserver.disconnect()
      }
    }

    // Fallback for window resize
    window.addEventListener("resize", updateChartSize)
    return () => window.removeEventListener("resize", updateChartSize)
  }, [])

  // Generate random position within chart bounds
  const getRandomPosition = () => {
    if (!chartRef.current) {
      return { x: 50, y: 50 } // Default fallback
    }

    const chartWidth = chartSize.width
    const chartHeight = chartSize.height

    // Add padding to ensure images aren't placed too close to the edges
    const padding = imageSize / 2

    // Generate random coordinates within the chart bounds
    const x = Math.floor(Math.random() * (chartWidth - imageSize - padding * 2)) + padding
    const y = Math.floor(Math.random() * (chartHeight - imageSize - padding * 2)) + padding

    return { x, y }
  }

  // Generate a profile image when a username is submitted
  const handleAddImage = async (e: FormEvent<HTMLInputElement>) => {

    if (!e.currentTarget.files) {
      return;
    }

    for (const file of e.currentTarget.files) {
      const objectUrl = URL.createObjectURL(file);

      // Get random position for the new image
      const randomPosition = getRandomPosition()

      // Create a temporary image with loading state
      const tempImageId = `image-${Date.now()}`
      const tempImage: ImageItem = {
        id: tempImageId,
        src: `/placeholder.svg?height=100&width=100&text=Loading...`,
        position: randomPosition,
        isDragging: false,
        loading: true,
        base64: ''
      }

      setImages((prev) => [...prev, tempImage])

      // Create an invisible div to hold the images for analysis
      const analysisDiv = document.createElement("div")
      analysisDiv.style.position = "absolute"
      analysisDiv.style.visibility = "hidden"
      analysisDiv.style.pointerEvents = "none"
      document.body.appendChild(analysisDiv)

      try {
        // Try to load both images
        const withAtImg = document.createElement("img")
        const withoutAtImg = document.createElement("img")

        withAtImg.crossOrigin = "anonymous"
        withoutAtImg.crossOrigin = "anonymous"

        // Set up load handlers
        const withAtPromise = new Promise<void>((resolve) => {
          withAtImg.onload = () => resolve()
          withAtImg.onerror = () => resolve() // Resolve even on error
          setTimeout(() => resolve(), 3000) // Timeout fallback
        })

        const withoutAtPromise = new Promise<void>((resolve) => {
          withoutAtImg.onload = () => resolve()
          withoutAtImg.onerror = () => resolve() // Resolve even on error
          setTimeout(() => resolve(), 3000) // Timeout fallback
        })

        // Start loading both images
        withAtImg.src = objectUrl
        withoutAtImg.src = objectUrl

        // Add images to the analysis div
        analysisDiv.appendChild(withAtImg)
        analysisDiv.appendChild(withoutAtImg)

        // Wait for both images to load or timeout
        await Promise.all([withAtPromise, withoutAtPromise])

        // Create canvases for analysis
        const withAtCanvas = document.createElement("canvas")
        const withoutAtCanvas = document.createElement("canvas")

        // Function to safely analyze an image by counting unique colors
        const analyzeColorfulness = (img: HTMLImageElement, canvas: HTMLCanvasElement): number => {
          try {
            if (!img.complete || img.naturalWidth === 0) {
              return 0 // Image didn't load properly
            }

            const ctx = canvas.getContext("2d")
            if (!ctx) return 0

            // Set canvas size
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight

            // Draw image on canvas
            ctx.drawImage(img, 0, 0)

            // Sample pixels to count unique colors
            const sampleSize = 20 // Increase sample size for better coverage
            const uniqueColors = new Set<string>()

            for (let y = 0; y < sampleSize; y++) {
              for (let x = 0; x < sampleSize; x++) {
                const sampleX = Math.floor((x / sampleSize) * canvas.width)
                const sampleY = Math.floor((y / sampleSize) * canvas.height)

                try {
                  const data = ctx.getImageData(sampleX, sampleY, 1, 1).data
                  const r = data[0]
                  const g = data[1]
                  const b = data[2]

                  // Create a string representation of the color
                  const colorKey = `${r},${g},${b}`
                  uniqueColors.add(colorKey)
                } catch (error) {
                  // Ignore errors for individual pixels
                }
              }
            }

            // Return the number of unique colors found
            return uniqueColors.size
          } catch (error) {
            // If any error occurs, return 0
            return 0
          }
        }

        // Analyze both images
        const withAtColorfulness = analyzeColorfulness(withAtImg, withAtCanvas)
        const withoutAtColorfulness = analyzeColorfulness(withoutAtImg, withoutAtCanvas)

        console.log("Unique colors count:", {
          withAt: withAtColorfulness,
          withoutAt: withoutAtColorfulness,
        })
      } catch (error) {
        console.error("Error analyzing images:", error)
        // On error, use the default URL
      } finally {
        // Clean up
        if (analysisDiv && analysisDiv.parentNode) {
          document.body.removeChild(analysisDiv)
        }

        const base64 = await imageFileToBase64(objectUrl)

        // Update the image with the final URL
        setImages((prev) => prev.map((img) => (img.id === tempImageId ? { ...img, src: objectUrl, base64, loading: false } : img)))
      }

      // const file = e.currentTarget.files[0];
    }
  }

  // Handle mouse down on an image
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault()

    // Find the image
    const image = images.find((img) => img.id === id)
    if (!image || image.loading) return

    // Calculate the offset from the mouse position to the image position
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })

    // Set the image as dragging
    setActiveDragId(id)

    // Update the image state
    setImages(images.map((img) => (img.id === id ? { ...img, isDragging: true } : img)))
  }

  // Handle touch start on an image (for mobile)
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    // Find the image
    const image = images.find((img) => img.id === id)
    if (!image || image.loading) return

    // Get the first touch
    const touch = e.touches[0]

    // Calculate the offset from the touch position to the image position
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    })

    // Set the image as dragging
    setActiveDragId(id)

    // Update the image state
    setImages(images.map((img) => (img.id === id ? { ...img, isDragging: true } : img)))
  }

  // Handle mouse move
  const handleMouseMove = (e: MouseEvent) => {
    if (!activeDragId || !chartRef.current) return

    // Get the chart bounds
    const chartRect = chartRef.current.getBoundingClientRect()

    // Calculate the new position relative to the chart
    const x = e.clientX - chartRect.left - offset.x
    const y = e.clientY - chartRect.top - offset.y

    // Update the image position
    setImages(
      images.map((img) =>
        img.id === activeDragId
          ? {
            ...img,
            position: {
              x: Math.max(0, Math.min(x, chartRect.width - imageSize)),
              y: Math.max(0, Math.min(y, chartRect.height - imageSize)),
            },
          }
          : img,
      ),
    )
  }

  // Handle touch move (for mobile)
  const handleTouchMove = (e: TouchEvent) => {
    if (!activeDragId || !chartRef.current) return

    // Prevent default to stop scrolling while dragging
    e.preventDefault()

    // Get the first touch
    const touch = e.touches[0]

    // Get the chart bounds
    const chartRect = chartRef.current.getBoundingClientRect()

    // Calculate the new position relative to the chart
    const x = touch.clientX - chartRect.left - offset.x
    const y = touch.clientY - chartRect.top - offset.y

    // Update the image position
    setImages(
      images.map((img) =>
        img.id === activeDragId
          ? {
            ...img,
            position: {
              x: Math.max(0, Math.min(x, chartRect.width - imageSize)),
              y: Math.max(0, Math.min(y, chartRect.height - imageSize)),
            },
          }
          : img,
      ),
    )
  }

  // Handle mouse up
  const handleMouseUp = () => {
    if (!activeDragId) return

    // Set the image as not dragging
    setImages(images.map((img) => (img.id === activeDragId ? { ...img, isDragging: false } : img)))

    // Reset the active drag
    setActiveDragId(null)
  }

  // Handle touch end (for mobile)
  const handleTouchEnd = () => {
    if (!activeDragId) return

    // Set the image as not dragging
    setImages(images.map((img) => (img.id === activeDragId ? { ...img, isDragging: false } : img)))

    // Reset the active drag
    setActiveDragId(null)
  }

  // Remove an image
  const handleRemoveImage = (id: string) => {
    setImages(images.filter((img) => img.id !== id))
  }

  // Add event listeners for mouse/touch move and mouse/touch up
  useEffect(() => {
    if (activeDragId) {
      // Mouse events
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)

      // Touch events for mobile
      window.addEventListener("touchmove", handleTouchMove, { passive: false })
      window.addEventListener("touchend", handleTouchEnd)
      window.addEventListener("touchcancel", handleTouchEnd)
    }

    return () => {
      // Remove mouse events
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)

      // Remove touch events
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)
      window.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [activeDragId, images, offset, imageSize])

  const handleSave = () => {
    const json = JSON.stringify(images.map(img => ({ base64: img.base64, id: img.id, isDragging: img.isDragging, position: img.position })), null, 2); // гарне форматування, опціонально
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    saveAs(blob, 'compass.json');
  };

  const handleImport = (e: FormEvent<HTMLInputElement>) => {
    if (!e.currentTarget.files) return;

    const file = e.currentTarget.files[0];

    // file.type

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target && typeof evt.target.result == 'string') {
        const parsed = JSON.parse(evt.target.result);
        setImages(parsed);
      }
    };

    reader.readAsText(file);
  }

  return (
    <div
      className={`flex flex-col ${isMobile ? "justify-start pt-4 px-8" : "justify-center"} min-h-screen w-full overflow-hidden`}
      ref={containerRef}
    >
      <div className="flex flex-col items-center gap-8 w-full px-4 min-h-[120vh] pt-4">
        <div className="space-y-2">
          <div className="relative w-full max-w-md flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Axis</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Axis Labels</h4>
                  </div>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="width">Top</Label>
                      <Input
                        defaultValue={axis.top}
                        className="col-span-2 h-8"
                        onInput={(e) => setAxisNames(prev => ({ ...prev, top: e.currentTarget ? e.currentTarget.value : '' }))}
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="maxWidth">Bottom</Label>
                      <Input
                        defaultValue={axis.bottom}
                        className="col-span-2 h-8"
                        onInput={(e) => setAxisNames(prev => ({ ...prev, bottom: e.currentTarget ? e.currentTarget.value : '' }))}
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="height">Right</Label>
                      <Input
                        defaultValue={axis.right}
                        className="col-span-2 h-8"
                        onInput={(e) => setAxisNames(prev => ({ ...prev, right: e.currentTarget ? e.currentTarget.value : '' }))}
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="maxHeight">Left</Label>
                      <Input
                        defaultValue={axis.left}
                        className="col-span-2 h-8"
                        onInput={(e) => setAxisNames(prev => ({ ...prev, left: e.currentTarget ? e.currentTarget.value : '' }))}
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Background</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="flex items-center flex-wrap gap-2">
                  {backgroundAssets.map(bg => (
                    <Image
                      src={bg}
                      alt=""
                      id={`${bg}-select`}
                      width={30}
                      height={30}
                      className={`border border-black/20 cursor-pointer transition hover:scale-95 ${background === bg ? 'outline-1 outline-black' : ''}`}
                      onClick={() => setBackground(prev => bg === prev ? undefined : bg)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button onClick={handleSave}>Save</Button>
            <Input type="file" accept=".json" placeholder="Import" onInput={handleImport} className="bg-blue-200"/>
          </div>
          <Input
            type="file"
            accept="image/*"
            multiple
            onInput={(e) => {
              e.preventDefault();
              handleAddImage(e);
            }}
          />
        </div>

        <div className="relative">
          {/* Axis Labels */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 font-bold text-lg md:text-lg text-sm border border-black rounded-full z-10">
            {axis.top}
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-white px-3 py-1 font-bold text-lg md:text-lg text-sm border border-black rounded-full z-10">
            {axis.bottom}
          </div>
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 font-bold text-lg md:text-lg text-sm border border-black rounded-full z-10 whitespace-nowrap mx-2">
            {axis.left}
          </div>
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 font-bold text-lg md:text-lg text-sm border border-black rounded-full z-10 whitespace-nowrap mx-2">
            {axis.right}
          </div>

          {/* Multi-Axis Labels */}
          <div className="absolute top-1/4 left-1/4 md:text-lg text-sm z-5 text-center opacity-35">
            <p>{axis.top}</p>
            <p>{axis.left}</p>
          </div>
          <div className="absolute top-1/4 right-1/4 md:text-lg text-sm z-5 text-center opacity-35">
            <p>{axis.top}</p>
            <p>{axis.right}</p>
          </div>
          <div className="absolute bottom-1/4 left-1/4 md:text-lg text-sm z-5 text-center opacity-35">
            <p>{axis.bottom}</p>
            <p>{axis.left}</p>
          </div>
          <div className="absolute bottom-1/4 right-1/4 md:text-lg text-sm z-5 text-center opacity-35">
            <p>{axis.bottom}</p>
            <p>{axis.right}</p>
          </div>

          <Card
            className="relative border-2 border-black overflow-hidden"
            ref={chartRef}
            style={{
              width: `${chartSize.width}px`,
              height: `${chartSize.height}px`,
            }}
          >
            <div
              className="w-full h-full relative"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            >
              {/* Axes */}
              <div className="absolute top-0 left-0 w-full h-full">
                {background && <img src={background} className="absolute top-0 left-0 w-full h-full border-t-2 border-black" alt="" />}
                <div className="absolute top-0 left-0 w-full h-full border-b-2 border-r-2 border-black" />
                <div className="absolute top-1/2 left-0 w-full h-0 border-t-2 border-black" />
                <div className="absolute top-0 left-1/2 w-0 h-full border-l-2 border-black" />
              </div>

              {/* Draggable Images */}
              {images.map((img) => (
                <div
                  key={img.id}
                  id={img.id}
                  className={`absolute cursor-${img.loading ? "wait" : "grab"} ${img.isDragging ? "z-10" : "z-0"} group z-20`}
                  style={{
                    left: `${img.position.x}px`,
                    top: `${img.position.y}px`,
                    width: `${imageSize}px`,
                    height: `${imageSize}px`,
                    transform: img.isDragging ? "scale(1.05)" : "scale(1)",
                    transition: img.isDragging ? "none" : "transform 0.1s ease",
                    opacity: img.loading ? 0.7 : 1,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, img.id)}
                  onTouchStart={(e) => handleTouchStart(e, img.id)}
                >
                  <div className="relative w-full h-full rounded-md overflow-hidden bg-white">
                    <Image
                      src={img.src ?? img.base64}
                      alt={`X avatar`}
                      width={100}
                      height={100}
                      className={`object-cover w-full h-full ${img.loading ? "animate-pulse" : ""}`}
                      unoptimized
                    />
                    {!img.loading && (
                      <button
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          fontSize: `${Math.max(10, imageSize / 8)}px`,
                          padding: `${Math.max(2, imageSize / 20)}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveImage(img.id)
                        }}
                      >
                        <X
                          className="w-3 h-3"
                          style={{
                            width: `${Math.max(8, imageSize / 10)}px`,
                            height: `${Math.max(8, imageSize / 10)}px`,
                          }}
                        />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
