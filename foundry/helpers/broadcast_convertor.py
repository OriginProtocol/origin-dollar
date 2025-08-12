import json
import sys
import os
import argparse

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Transform JSON format for Safe transactions')
    parser.add_argument(
        '--input', '-i',
        required=True,
        help='Path to input JSON file'
    )
    parser.add_argument(
        '--output', '-o',
        help='Path to output JSON file (default: adds -safe to input filename)'
    )
    parser.add_argument(
        '--suffix',
        default='safe',
        help='Suffix to add to filename (default: safe)'
    )
    return parser.parse_args()

def load_input_json(file_path):
    """Load JSON from file"""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in file '{file_path}': {e}")
        sys.exit(1)

def transform_json(input_data):
    """Transform input JSON to target format"""
    # Create output structure
    output_json = {
        "version": "1.0",
        "chainId": str(input_data["chain"]),
        "createdAt": input_data["timestamp"] // 1000,  # Convert ms to seconds
        "meta": {
            "name": "Transactions Batch",
            "description": "",
            "txBuilderVersion": "1.16.1",
            "createdFromSafeAddress": "",
            "createdFromOwnerAddress": ""
        },
        "transactions": []
    }
    
    # Extract Safe address from first transaction (from field)
    if input_data["transactions"]:
        safe_address = input_data["transactions"][0]["transaction"]["from"]
        output_json["meta"]["createdFromSafeAddress"] = safe_address
    
    # Transform each transaction
    for tx in input_data["transactions"]:
        transaction = tx["transaction"]
        
        # Convert hex value to integer then to string
        value = str(int(transaction["value"], 16))
        
        transformed_tx = {
            "to": transaction["to"],
            "value": value,
            "data": transaction["input"],
            "contractMethod": None,
            "contractInputsValues": None
        }
        
        output_json["transactions"].append(transformed_tx)
    
    return output_json

def get_output_path(input_path, suffix, custom_output=None):
    """Generate output path by adding suffix before file extension"""
    if custom_output:
        return custom_output
    
    name, ext = os.path.splitext(input_path)
    return f"{name}-{suffix}{ext}"

def main():
    """Main function"""
    args = parse_arguments()
    
    # Load input JSON
    input_data = load_input_json(args.input)
    
    # Transform JSON
    result = transform_json(input_data)
    
    # Generate output path and save
    output_path = get_output_path(args.input, args.suffix, args.output)
    try:
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Successfully transformed and saved to: {output_path}")
    except Exception as e:
        print(f"Error writing to file '{output_path}': {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()