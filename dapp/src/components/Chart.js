import { Line } from 'react-chartjs-2'
import withIsMobile from 'hoc/withIsMobile'

const LineChart = ({ chartData, isMobile }) => {
  return (
    <div>
      <Line
        data={chartData}
        options={{
          responsive: true,
          aspectRatio: isMobile ? 1 : 3,
          plugins: {
            title: {
              display: false,
            },
            legend: {
              display: false,
              position: 'bottom',
            },
            tooltip: {
              bodySpacing: 10,
              padding: 10,
              borderColor: '#8493a6',
              borderWidth: 1,
              bodyFont: { size: 32 },
              titleColor: '#b5beca',
              titleFont: { size: 16 },
              displayColors: false,
              backgroundColor: '#1e1f25C0',
              callbacks: {
                label: function (context) {
                  const value = context.parsed.y
                  return value + '%'
                },
                label: function (tooltipItem) {
                  return tooltipItem.formattedValue + '%'
                },
              },
            },
          },
          interaction: {
            mode: 'nearest',
            intersect: false,
            axis: 'x',
          },
          scales: {
            x: {
              grid: {
                display: false,
                borderColor: '#8493a6',
                borderWidth: 2,
                padding: -100,
              },
              ticks: {
                color: '#b5beca',
                autoSkip: false,
                maxRotation: 90,
                minRotation: 0,
                padding: 20,
                callback: function (val, index) {
                  return (
                    isMobile ? (index + 22) % 28 === 0 : (index + 8) % 14 === 0
                  )
                    ? this.getLabelForValue(val)
                    : null
                },
              },
            },
            y: {
              beginAtZero: true,
              position: 'right',
              ticks: {
                color: '#b5beca',
                callback: function (val) {
                  return val === 0 ? null : this.getLabelForValue(val)
                },
              },
            },
          },
        }}
      />
    </div>
  )
}

export default withIsMobile(LineChart)
