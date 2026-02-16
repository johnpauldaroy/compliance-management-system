import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import desktopSlide1 from '../assets/login/1.png';
import desktopSlide2 from '../assets/login/2.png';
import desktopSlide3 from '../assets/login/3.png';
import phoneSlide1 from '../assets/login/7.png';
import phoneSlide2 from '../assets/login/8.png';
import phoneSlide3 from '../assets/login/9.png';
import { authService } from '../services/authService';
import './LoginPage.css';

const LoginPage: React.FC = () => {
    const [activeSlide, setActiveSlide] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const carouselImages = [desktopSlide1, desktopSlide2, desktopSlide3];
    const mobileCarouselImages = [phoneSlide1, phoneSlide2, phoneSlide3];
    const carouselCopy = [
        {
            title: 'Compliance-Ready Oversight',
            description: 'Maintain compliant oversight of cooperative assets and activities for regulators.',
        },
        {
            title: 'Clear Audit Trails',
            description: 'Keep traceable records aligned with government reporting requirements.',
        },
        {
            title: 'Accountable Reporting',
            description: 'Submit accurate reports and approvals to meet agency compliance standards.',
        },
    ];

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 900px)');
        const updateIsMobile = () => setIsMobile(mediaQuery.matches);
        updateIsMobile();
        mediaQuery.addEventListener('change', updateIsMobile);
        return () => mediaQuery.removeEventListener('change', updateIsMobile);
    }, []);

    useEffect(() => {
        if (isMobile) {
            setActiveSlide(0);
            return;
        }

        const intervalId = window.setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % carouselImages.length);
        }, 4500);

        return () => window.clearInterval(intervalId);
    }, [carouselImages.length, isMobile]);

    useEffect(() => {
        document.body.classList.add('login-body');
        return () => {
            document.body.classList.remove('login-body');
        };
    }, []);

    useEffect(() => {
        let isActive = true;
        authService
            .me()
            .then(() => {
                if (isActive) {
                    navigate('/');
                }
            })
            .catch(() => {});

        return () => {
            isActive = false;
        };
    }, [navigate]);

    const onFinish = async (values: { email: string; password: string }) => {
        setLoading(true);
        try {
            await authService.login(values);
            message.success('Welcome back!');
            navigate('/');
        } catch (error: any) {
            console.error('Login Error:', error);
            message.error(error.response?.data?.message || 'Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-left">
                    <img
                        src={mobileCarouselImages[isMobile ? 0 : activeSlide]}
                        alt="Carousel slide"
                        className="login-slide login-slide-mobile"
                    />
                    <img
                        src={carouselImages[activeSlide]}
                        alt="Carousel slide"
                        className="login-slide login-slide-desktop"
                    />
                    <div className="login-left-overlay" />
                    <div className="login-left-caption">
                        <h2>{carouselCopy[activeSlide]?.title}</h2>
                        <p>{carouselCopy[activeSlide]?.description}</p>
                    </div>
                    {!isMobile && (
                        <div className="login-dots">
                            {carouselImages.map((_, index) => (
                                <button
                                    key={`slide-${index}`}
                                    type="button"
                                    aria-label={`Go to slide ${index + 1}`}
                                    className={activeSlide === index ? 'active' : ''}
                                    onClick={() => setActiveSlide(index)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="login-right">
                    <div className="login-header">
                        <img
                            src="/cms-logo-black.png"
                            alt="Organization logo"
                            style={{ width: 140, height: 'auto' }}
                        />
                        <Typography.Text className="login-kicker">
                            Compliance Management System
                        </Typography.Text>
                        <Typography.Text type="secondary">Please login to your account</Typography.Text>
                    </div>
                    <Form name="login" onFinish={onFinish} size="large" layout="vertical" className="login-form">
                        <Form.Item
                            label="Email Address"
                            name="email"
                            style={{ marginBottom: 12 }}
                            rules={[
                                { required: true, message: 'Please input your Email!' },
                                { type: 'email', message: 'Please enter a valid email!' }
                            ]}
                        >
                            <Input prefix={<UserOutlined />} placeholder="Enter your email" />
                        </Form.Item>
                        <Form.Item
                            label="Password"
                            name="password"
                            style={{ marginBottom: 12 }}
                            rules={[{ required: true, message: 'Please input your Password!' }]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="Enter your password" />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" block className="login-button" loading={loading}>
                                Log in
                            </Button>
                        </Form.Item>
                        <Typography.Text type="secondary" className="login-footer">
                            Secure access to Compliance Management System
                        </Typography.Text>
                    </Form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
