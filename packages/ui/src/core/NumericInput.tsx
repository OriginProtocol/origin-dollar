import { useState, useEffect } from 'react';
import { isNaN, isNumber, isString } from 'lodash';
import { useKey } from '@originprotocol/hooks';

const IS_IOS =
  typeof navigator !== 'undefined'
    ? navigator.userAgent.match(/iPhone|iPad|iPod/i)
    : false;

const parseText = (text) => {
  if (isNumber(text)) return text;

  if (isString(text)) {
    text = text.trim();

    if (!text) return '';
    const num = parseFloat(text);

    if (!isNaN(num)) {
      return num;
    }
  }

  return '';
};

const changeValue = (mod, value, max, min, step) => {
  if (value === '') {
    if (isNumber(min)) return min;
    return '';
  }

  value = mod === '+' ? value + step : value - step;

  if (isNumber(max) && value > max) return max;
  if (isNumber(min) && value < min) return min;

  const p = (step.toString().split('.')[1] || []).length;
  if (p) {
    return parseFloat(value.toFixed(p));
  }

  return value;
};

const Input = ({ onChange, ...props }) => {
  function handleChange(e) {
    if (onChange) {
      onChange(e.target.value);
    }
  }
  return <input {...props} onChange={handleChange} />;
};

const NumericInput = ({
  step,
  min,
  max,
  value,
  onChange,
  enableMobileNumericKeyboard,
  ...props
}) => {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleChange = (text) => {
    const value = parseText(text);
    setText(text);
    if (onChange) {
      onChange(value);
    }
  };

  const handleWheel = (e) => {
    e.target.blur();
  };

  useKey('ArrowUp', () => {
    if (onChange) {
      onChange(changeValue('+', value, max, min, step));
    }
  });

  useKey('ArrowDown', () => {
    if (onChange) {
      onChange(changeValue('-', value, max, min, step));
    }
  });

  const inputProps = {
    value: text,
    onChange: handleChange,
    onWheel: handleWheel,
  };

  if (enableMobileNumericKeyboard) {
    return (
      <Input
        {...props}
        {...inputProps}
        styles={{
          MozAppearance: 'textfield',
          '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
          },
        }}
        type="number"
        inputMode="numeric"
        pattern={IS_IOS ? `[0-9]*` : ''}
        step={step}
        min={min}
        max={max}
      />
    );
  }

  return <Input {...props} {...inputProps} type="text" />;
};

NumericInput.defaultProps = {
  autoComplete: 'off',
  enableMobileNumericKeyboard: false,
  value: '',
  step: 1,
  min: 0,
};

export default NumericInput;
