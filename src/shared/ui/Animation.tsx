import Lottie from "lottie-react";
import swipleAnimation from "./swipe.json";

const namesMap: any = {
    swipe: swipleAnimation
}

export const Animation = ({ name }: { name: string }) => {
    return (
        <Lottie style={{ width: '100%', height: '100%'}} animationData={namesMap[name]} loop={true} autoplay />
    )
}