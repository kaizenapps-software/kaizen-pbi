import React from "react"
import { brand } from "../branding/assets"

/**
 * Brand
 * - showMark: muestra el isotipo a la izquierda
 * - wordmarkHeight: alto del logotipo tipográfico
 * - markSize: alto/ancho del isotipo
 */
export default function Brand({
  showMark = false,
  wordmarkHeight = 28,
  markSize = 26,
  className = "",
}) {
  return (
    <div className={"flex items-center gap-2 select-none " + className}>
      {showMark && (
        <img
          src={brand.markWhite}
          alt="Kaizen mark"
          style={{ height: markSize, width: markSize, objectFit: "contain" }}
          draggable="false"
          loading="eager"
        />
      )}

      {/* Light */}
      <img
        src={brand.wordDark}
        alt="Kaizen"
        className="block dark:hidden"
        style={{ height: wordmarkHeight, objectFit: "contain" }}
        draggable="false"
        loading="eager"
      />
      {/* Dark */}
      <img
        src={brand.wordWhite}
        alt="Kaizen"
        className="hidden dark:block"
        style={{ height: wordmarkHeight, objectFit: "contain" }}
        draggable="false"
        loading="eager"
      />
    </div>
  )
}
