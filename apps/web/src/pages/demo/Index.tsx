import React from "react";

export default function Index() {
    const [tickCount, setTickCount] = React.useState<number>(0);

    const tickTimer = React.useRef<number | null>(null);

    const tick = React.useCallback(() => {
        setTickCount(count => count + 1);

        tickTimer.current = window.setTimeout(tick, 1000);
    }, []);

    React.useEffect(() => {
        tickTimer.current = window.setTimeout(tick, 1000);

        return () => {
            if (tickTimer.current !== null) {
                window.clearTimeout(tickTimer.current);
                tickTimer.current = null;
            }
            setTickCount(0);
        };
    }, [tick]);

    return (
        <div>
            <h1>当前计数: {tickCount}</h1>
        </div>
    );
}