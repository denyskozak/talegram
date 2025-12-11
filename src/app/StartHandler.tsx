import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLaunchParams } from "@tma.js/sdk-react";

export function StartRouteHandler(): null {
    const navigate = useNavigate();
    const launchParams = useLaunchParams();
    const  startParam  = launchParams?.tgWebAppData?.start_param ?? '';

    const handledRef = useRef(false);
    console.log("startParam: ", startParam);

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
        
        if (startParam.startsWith("reader_")) {
            const hasPreview = startParam.includes("preview_1")
            const [,bookId] = startParam.match(/reader_(.+)_books/)!;
            navigate(`/reader/${bookId}/books${hasPreview ? '?preview=1' : ''}`, {
                replace: true,
            });
            return;
        }

        // navigate("reader/53fb29b1-f320-4421-9afa-bc8957cafe6c/books?preview=1", {
        //     replace: true,
        // });
    }, [navigate, startParam]);

    return null;
}
