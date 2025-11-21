import { useState} from "react";

// import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./ReadingOverlay.css";
import {ReactReader} from "react-reader";

type ReadingOverlayProps = {
  fileUrl: string;
};

export function ReadingOverlay({ fileUrl }: ReadingOverlayProps): JSX.Element {
    const [location, setLocation] = useState<string | number>(0)
    console.log("location: ", location);

    return (
      <div style={{ height: '90vh' }}>
          <ReactReader
              url={fileUrl}
              location={location}
              locationChanged={(epubcfi: string) => setLocation(epubcfi)}
          />
      </div>
  );
}
