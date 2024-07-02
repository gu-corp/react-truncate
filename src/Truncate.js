import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";

const Truncate = ({
  children = "",
  ellipsis = "…",
  lines = 1,
  trimWhitespace = false,
  width = 0,
  onTruncate,
}) => {
  const elements = useRef({});
  const [targetWidth, setTargetWidth] = useState(0);
  const canvasContext = useRef(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvasContext.current = canvas.getContext("2d");
    calcTargetWidth(() => {
      if (elements.current.text) {
        elements.current.text.parentNode.removeChild(elements.current.text);
      }
    });

    window.addEventListener("resize", onResize);
    return () => {
      if (elements.current.ellipsis && elements.current.ellipsis.parentNode) {
        elements.current.ellipsis.parentNode.removeChild(
          elements.current.ellipsis
        );
      }
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    calcTargetWidth();
  }, [width]);

  useEffect(() => {
    forceUpdate();
  }, [children]);

  const forceUpdate = () => {
    calcTargetWidth();
  };

  const onResize = () => {
    calcTargetWidth();
  };

  const calcTargetWidth = (callback) => {
    const target = elements.current.target;

    // Calculation is no longer relevant, since node has been removed
    if (!target) return;

    const newTargetWidth =
      width || Math.floor(target.parentNode.getBoundingClientRect().width);

    // Delay calculation until parent node is inserted to the document
    // Mounting order in React is ChildComponent, ParentComponent
    if (!newTargetWidth) {
      return window.requestAnimationFrame(() => calcTargetWidth(callback));
    }

    const style = window.getComputedStyle(target);

    const font = [
      style["font-weight"],
      style["font-style"],
      style["font-size"],
      style["font-family"],
    ].join(" ");

    canvasContext.current.font = font;

    setTargetWidth(newTargetWidth);
    if (callback) callback();
  };

  const measureWidth = (text) => {
    return canvasContext.current.measureText(text).width;
  };

  const getEllipsisWidth = (node) => {
    return node.offsetWidth;
  };

  const trimRight = (text) => {
    return text.replace(/\s+$/, "");
  };

  const getLines = () => {
    const text = innerText(elements.current.text);
    const textLines = text.split("\n").map((line) => line.split(" "));
    const linesResult = [];
    let didTruncate = true;
    const ellipsisNodeWidth = getEllipsisWidth(elements.current.ellipsis);

    for (let line = 1; line <= lines; line++) {
      const textWords = textLines[0];

      // Handle newline
      if (textWords.length === 0) {
        linesResult.push();
        textLines.shift();
        line--;
        continue;
      }

      let resultLine = textWords.join(" ");

      if (measureWidth(resultLine) <= targetWidth) {
        if (textLines.length === 1) {
          // Line is end of text and fits without truncating
          didTruncate = false;
          linesResult.push(resultLine);
          break;
        }
      }

      if (line === lines) {
        // Binary search determining the longest possible line inluding truncate string
        const textRest = textWords.join(" ");
        let lower = 0;
        let upper = textRest.length - 1;

        while (lower <= upper) {
          const middle = Math.floor((lower + upper) / 2);
          const testLine = textRest.slice(0, middle + 1);

          if (measureWidth(testLine) + ellipsisNodeWidth <= targetWidth) {
            lower = middle + 1;
          } else {
            upper = middle - 1;
          }
        }

        let lastLineText = textRest.slice(0, lower);

        if (trimWhitespace) {
          lastLineText = trimRight(lastLineText);
          // Remove blank lines from the end of text
          while (!lastLineText.length && linesResult.length) {
            const prevLine = linesResult.pop();
            lastLineText = trimRight(prevLine);
          }
        }

        resultLine = (
          <span key="last">
            {lastLineText}
            {ellipsis}
          </span>
        );
      } else {
        // Binary search determining when the line breaks
        let lower = 0;
        let upper = textWords.length - 1;

        while (lower <= upper) {
          const middle = Math.floor((lower + upper) / 2);
          const testLine = textWords.slice(0, middle + 1).join(" ");

          if (measureWidth(testLine) <= targetWidth) {
            lower = middle + 1;
          } else {
            upper = middle - 1;
          }
        }

        // The first word of this line is too long to fit it
        if (lower === 0) {
          // Jump to processing of last line
          line = lines - 1;
          continue;
        }

        resultLine = textWords.slice(0, lower).join(" ");
        textLines[0].splice(0, lower);
      }

      linesResult.push(resultLine);
    }

    if (typeof onTruncate === "function") {
      window.requestAnimationFrame(() => {
        onTruncate(didTruncate);
      });
    }

    return linesResult;
  };

  const renderLine = (line, i, arr) => {
    if (i === arr.length - 1) {
      return <span key={i}>{line}</span>;
    } else {
      const br = <br key={i + "br"} />;

      if (line) {
        return [<span key={i}>{line}</span>, br];
      } else {
        return br;
      }
    }
  };

  // Shim innerText to consistently break lines at <br/> but not at \n
  const innerText = (node) => {
    const div = document.createElement("div");
    const contentKey =
      "innerText" in window.HTMLElement.prototype ? "innerText" : "textContent";

    div.innerHTML = node.innerHTML.replace(/\r\n|\r|\n/g, " ");

    let text = div[contentKey];

    const test = document.createElement("div");
    test.innerHTML = "foo<br/>bar";

    if (test[contentKey].replace(/\r\n|\r/g, "\n") !== "foo\nbar") {
      div.innerHTML = div.innerHTML.replace(/<br.*?[\/]?>/gi, "\n");
      text = div[contentKey];
    }

    return text;
  };

  let text;

  const mounted = !!(elements.current.target && targetWidth);

  if (typeof window !== "undefined" && mounted) {
    if (lines > 0) {
      text = getLines().map(renderLine);
    } else {
      text = children;
      onTruncate(false);
    }
  }

  return (
    <span
      ref={(el) => {
        elements.current.target = el;
      }}
    >
      <span>{text}</span>
      <span
        ref={(el) => {
          elements.current.text = el;
        }}
      >
        {children}
      </span>
      <span
        ref={(el) => {
          elements.current.ellipsis = el;
        }}
        style={styles.ellipsis}
      >
        {ellipsis}
      </span>
    </span>
  );
};

Truncate.propTypes = {
  children: PropTypes.node,
  ellipsis: PropTypes.node,
  lines: PropTypes.oneOfType([PropTypes.oneOf([false]), PropTypes.number]),
  trimWhitespace: PropTypes.bool,
  width: PropTypes.number,
  onTruncate: PropTypes.func,
};

const styles = {
  ellipsis: {
    position: "fixed",
    visibility: "hidden",
    top: 0,
    left: 0,
  },
};

export default Truncate;
