import { Line } from "react-chartjs-2";

export const LineChart = ({ chartData }) => {
  return (
    <div>
      <Line
        data={chartData}
        options={{
          plugins: {
            title: {
              display: false,
            },
            legend: {
              display: false,
              position: "bottom"
           }
          }
        }}
      />
    </div>
  );
};