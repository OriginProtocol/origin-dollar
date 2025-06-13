import pandas as pd
import numpy as np
from datetime import datetime
import matplotlib.pyplot as plt
import seaborn as sns

class DeltaNeutralStrategy:
  def __init__(self, data_path):
    # Read the data with the correct column names
    self.data = pd.read_csv(data_path)
    
    # Convert timestamp columns to datetime
    self.data['Open time'] = pd.to_datetime(self.data['Open time'])
    self.data['Close time'] = pd.to_datetime(self.data['Close time'])
    
    # Filter data from January 1, 2020
    start_date = pd.Timestamp('2020-01-01')
    self.data = self.data[self.data['Open time'] >= start_date]
    
    # Set Open time as index
    self.data.set_index('Open time', inplace=True)
    
    # Rename columns for easier access
    self.data.rename(columns={
      'Open': 'open',
      'High': 'high',
      'Low': 'low',
      'Close': 'close',
      'Volume': 'volume',
      'Quote asset volume': 'quote_volume',
      'Number of trades': 'trades',
      'Taker buy base asset volume': 'taker_buy_volume',
      'Taker buy quote asset volume': 'taker_buy_quote_volume'
    }, inplace=True)
      
  def calculate_strategy_performance(self, 
    btc_collateral_ratio=0.5,  # How much BTC value we borrow against
    spot_long_ratio=0.66,      # How much of borrowed USDC goes to spot long
    perp_short_ratio=0.33,     # How much of borrowed USDC goes to perp short
    perp_leverage=2.0,         # Perpetual leverage
    funding_rate=0.000009,     # Hourly funding rate (0.0009%)
    initial_capital=100):      # Initial capital in BTC
    
    # Calculate daily returns
    self.data['daily_return'] = self.data['close'].pct_change()
    
    # Strategy components
    btc_value = initial_capital  # Starting with 100 BTC
    borrowed_usdc = btc_value * btc_collateral_ratio
    
    # Position sizes
    spot_long_usdc = borrowed_usdc * spot_long_ratio
    perp_short_usdc = borrowed_usdc * perp_short_ratio
    
    # Calculate strategy returns
    self.data['spot_long_return'] = self.data['daily_return'] * (spot_long_usdc / btc_value)
    self.data['perp_short_return'] = -self.data['daily_return'] * (perp_short_usdc * perp_leverage / btc_value)
    self.data['funding_income'] = (perp_short_usdc * perp_leverage / btc_value) * funding_rate
    
    # Total strategy return
    self.data['strategy_return'] = (self.data['spot_long_return'] + 
                                  self.data['perp_short_return'] + 
                                  self.data['funding_income'])
    
    # Calculate cumulative returns and actual BTC value
    self.data['cumulative_strategy_return'] = (1 + self.data['strategy_return']).cumprod()
    self.data['btc_value'] = btc_value * self.data['cumulative_strategy_return']
    
    # Calculate hourly and annualized metrics
    hourly_return = self.data['strategy_return'].mean()
    annualized_return = hourly_return * 24 * 365
    hourly_volatility = self.data['strategy_return'].std()
    annualized_volatility = hourly_volatility * np.sqrt(24 * 365)
    sharpe_ratio = annualized_return / annualized_volatility
    
    # Calculate total funding income
    total_funding_income = self.data['funding_income'].sum() * btc_value
    
    # Calculate maximum drawdown
    max_drawdown = (self.data['cumulative_strategy_return'] / 
                   self.data['cumulative_strategy_return'].cummax() - 1).min()
    
    # Calculate win rate
    win_rate = (self.data['strategy_return'] > 0).mean()
    
    # Print strategy metrics
    print(f"\nStrategy Performance with {initial_capital} BTC:")
    print(f"Annualized Return: {annualized_return:.2%}")
    print(f"Annualized Volatility: {annualized_volatility:.2%}")
    print(f"Sharpe Ratio: {sharpe_ratio:.2f}")
    print(f"Maximum Drawdown: {max_drawdown:.2%}")
    print(f"Win Rate: {win_rate:.2%}")
    print(f"Total Funding Income: {total_funding_income:.2f} BTC")
    print(f"Final Portfolio Value: {self.data['btc_value'].iloc[-1]:.2f} BTC")
    
    return self.data
  
  def analyze_leverage_scenarios(self):
    """Analyze different leverage scenarios"""
    scenarios = []
    
    # Test different collateral ratios
    for collateral_ratio in [0.5, 0.6, 0.7, 0.8]:
      # Test different spot/perpetual ratios
      for spot_ratio in [0.6, 0.66, 0.7, 0.8]:
          perp_ratio = 1 - spot_ratio
          
          # Calculate performance
          results = self.calculate_strategy_performance(
            btc_collateral_ratio=collateral_ratio,
            spot_long_ratio=spot_ratio,
            perp_short_ratio=perp_ratio
          )
          
          # Calculate metrics
          total_return = results['cumulative_strategy_return'].iloc[-1] - 1
          volatility = results['strategy_return'].std() * np.sqrt(24 * 365)  # Annualized hourly volatility
          sharpe_ratio = (results['strategy_return'].mean() * 24 * 365) / volatility
          max_drawdown = (results['cumulative_strategy_return'] / 
                        results['cumulative_strategy_return'].cummax() - 1).min()
          
          # Calculate additional metrics
          win_rate = (results['strategy_return'] > 0).mean()
          avg_win = results[results['strategy_return'] > 0]['strategy_return'].mean()
          avg_loss = results[results['strategy_return'] < 0]['strategy_return'].mean()
          
          # Calculate funding income
          total_funding_income = results['funding_income'].sum() * 100  # For 100 BTC
          
          scenarios.append({
            'collateral_ratio': collateral_ratio,
            'spot_ratio': spot_ratio,
            'perp_ratio': perp_ratio,
            'total_return': total_return,
            'volatility': volatility,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown': max_drawdown,
            'win_rate': win_rate,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'total_funding_income_btc': total_funding_income,
            'final_portfolio_value_btc': results['btc_value'].iloc[-1]
          })
    
    # Create DataFrame and save to CSV
    scenarios_df = pd.DataFrame(scenarios)
    scenarios_df.to_csv('leverage_scenarios_analysis.csv', index=False)
    print("\nLeverage scenarios analysis saved to 'leverage_scenarios_analysis.csv'")
    
    return scenarios_df
  
  def analyze_volatility_impact(self):
    """Analyze strategy performance during high volatility periods"""
    # Calculate rolling volatility (30-day window)
    self.data['rolling_vol'] = self.data['daily_return'].rolling(window=30*24).std() * np.sqrt(24 * 365)  # Annualized hourly volatility
    
    # Define high volatility periods (top 25% of volatility)
    high_vol_threshold = self.data['rolling_vol'].quantile(0.75)
    high_vol_periods = self.data[self.data['rolling_vol'] > high_vol_threshold]
    
    # Calculate strategy performance during high volatility
    high_vol_performance = self.calculate_strategy_performance()
    high_vol_performance = high_vol_performance[high_vol_performance.index.isin(high_vol_periods.index)]
    
    # Calculate additional metrics for high volatility periods
    high_vol_metrics = {
      'high_vol_periods': len(high_vol_periods),
      'high_vol_return': high_vol_performance['strategy_return'].mean() * 24 * 365,  # Annualized
      'high_vol_volatility': high_vol_performance['strategy_return'].std() * np.sqrt(24 * 365),
      'high_vol_max_drawdown': (high_vol_performance['cumulative_strategy_return'] / 
                              high_vol_performance['cumulative_strategy_return'].cummax() - 1).min(),
      'high_vol_win_rate': (high_vol_performance['strategy_return'] > 0).mean(),
      'avg_win_high_vol': high_vol_performance[high_vol_performance['strategy_return'] > 0]['strategy_return'].mean(),
      'avg_loss_high_vol': high_vol_performance[high_vol_performance['strategy_return'] < 0]['strategy_return'].mean()
    }
    
    return high_vol_metrics
  
  def plot_strategy_analysis(self):
    """Create visualization of strategy analysis"""
    results = self.calculate_strategy_performance()
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
    
    # Plot cumulative returns
    ax1.plot(results.index, results['btc_value'], label='Strategy Value (BTC)')
    ax1.plot(results.index, results['close'] * 100 / results['close'].iloc[0], label='BTC Price (Normalized)')
    ax1.set_title('Portfolio Value vs BTC Price')
    ax1.legend()
    
    # Plot drawdown
    drawdown = results['cumulative_strategy_return'] / results['cumulative_strategy_return'].cummax() - 1
    ax2.fill_between(results.index, drawdown, 0, color='red', alpha=0.3)
    ax2.set_title('Strategy Drawdown')
    
    # Plot rolling volatility
    ax3.plot(results.index, results['rolling_vol'])
    ax3.set_title('30-Day Rolling Volatility')
    
    # Plot funding income vs strategy return
    ax4.scatter(results['funding_income'], results['strategy_return'], alpha=0.5)
    ax4.set_title('Funding Income vs Strategy Return')
    ax4.set_xlabel('Funding Income')
    ax4.set_ylabel('Strategy Return')
    
    plt.tight_layout()
    plt.show()

def main():
  # Initialize strategy analyzer
  analyzer = DeltaNeutralStrategy('BTCUSD_1h_Binance.csv')
  
  # Analyze different leverage scenarios
  scenarios = analyzer.analyze_leverage_scenarios()
  print("\nLeverage Scenarios Analysis:")
  print(scenarios.sort_values('sharpe_ratio', ascending=False).head())
  
  # Analyze volatility impact
  vol_analysis = analyzer.analyze_volatility_impact()
  print("\nVolatility Impact Analysis:")
  for key, value in vol_analysis.items():
    print(f"{key}: {value:.4f}")
  
  # Plot strategy analysis
  analyzer.plot_strategy_analysis()

if __name__ == "__main__":
  main()
