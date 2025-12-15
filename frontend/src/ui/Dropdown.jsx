import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dropdown({
    options = [],
    value,
    onChange,
    placeholder = "Seleccionar...",
    className = "",
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const selectedOption = options.find((o) => o.value === value);

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (val) => {
        onChange && onChange(val);
        setIsOpen(false);
    };

    return (
        <div className={`relative min-w-[200px] ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-panel border border-border rounded-lg shadow-sm hover:border-primary/50 transition-colors text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
                <span className={selectedOption ? "text-foreground" : "text-muted"}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg
                    className={`w-4 h-4 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-full mt-1 overflow-hidden bg-panel border border-border rounded-lg shadow-lg"
                    >
                        <div className="max-h-60 overflow-y-auto py-1">
                            {options.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-muted text-center">No hay opciones</div>
                            ) : (
                                options.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelect(option.value)}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors
                      ${option.value === value
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-foreground hover:bg-muted/10"
                                            }
                    `}
                                    >
                                        {option.label}
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
