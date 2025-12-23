import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLaunchParams } from "@tma.js/sdk-react";

export function StartRouteHandler(): null {
    const navigate = useNavigate();
    const launchParams = useLaunchParams();
    const  startParam  = launchParams?.tgWebAppData?.start_param ?? '';

    const handledRef = useRef(false);

    useEffect(() => {
        if (typeof startParam !== 'string') return;
        if (handledRef.current) return;
        handledRef.current = true;
        console.log("www: ",  startParam.startsWith("reader_"));
        // mapping start_param -> route
        if (startParam.startsWith("book_")) {
            navigate(`/book/${startParam.replace("book_", "")}`, {
                replace: true,
            });
            return;
        }

        if (startParam.startsWith("audiobooks")) {
            navigate(`/audiobooks`, {
                replace: true,
            });
            return;
        }
        
        if (startParam.startsWith("reader_")) {
            const hasPreview = startParam.includes("preview_1");
            const [, bookId, encodedLocation] = startParam.match(/reader_([^_]+)_books(?:_loc_([^_]+))?/) || [];

            if (bookId) {
                const query = new URLSearchParams();

                if (hasPreview) {
                    query.set("preview", "1");
                }

                if (encodedLocation) {
                    query.set("location", decodeURIComponent(encodedLocation));
                }

                const queryString = query.toString();

                navigate(`/reader/${bookId}/books${queryString ? `?${queryString}` : ""}`, {
                    replace: true,
                });
            }

            return;
        }

        if (startParam.startsWith("listen_")) {
            const hasPreview = startParam.includes("preview_1");
            const [, bookId, contentType, audioBookId, timeSeconds] =
                startParam.match(/listen_([^_]+)_([^_]+)(?:_audio_([^_]+))?(?:_time_(\d+))?/) || [];

            if (bookId && contentType) {
                const query = new URLSearchParams();

                if (audioBookId) {
                    query.set("audioBookId", audioBookId);
                }

                if (hasPreview) {
                    query.set("preview", "1");
                }

                if (timeSeconds) {
                    query.set("time", timeSeconds);
                }

                const queryString = query.toString();

                navigate(`/listen/${bookId}/${contentType}${queryString ? `?${queryString}` : ""}`, {
                    replace: true,
                });
            }

            return;
        }

        // navigate("reader/53fb29b1-f320-4421-9afa-bc8957cafe6c/books?preview=1", {
        //     replace: true,
        // });
    }, [navigate, startParam]);

    return null;
}
